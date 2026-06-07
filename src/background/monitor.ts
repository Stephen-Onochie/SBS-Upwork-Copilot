import { get, getNotificationConfig, isMonitorSnoozed, hasSeenJob, markJobSeen } from '@/lib/storage'
import { scoreJob } from './scorer'
import { logEvent } from './supabase'
import { hashJobId, randomJitterMs, isInQuietHours, truncate } from '@/lib/utils'
import type { JobPost, JobBudget } from '@/lib/types'

const ALARM_NAME = 'job-monitor'
const PROFILE_REMINDER_ALARM = 'profile-reminder'

export function initMonitor(): void {
  setupProfileReminderAlarm()
  setupMonitorAlarm()

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) handleMonitorAlarm()
    if (alarm.name.startsWith(ALARM_NAME + '-reschedule')) handleMonitorAlarm()
    if (alarm.name === PROFILE_REMINDER_ALARM) handleProfileReminderAlarm()
  })
}

async function setupMonitorAlarm(): Promise<void> {
  const { monitor_interval_minutes } = await get(['monitor_interval_minutes'])
  const intervalMins = monitor_interval_minutes ?? 3

  await chrome.alarms.clear(ALARM_NAME)
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: intervalMins,
    periodInMinutes: intervalMins,
  })
}

function setupProfileReminderAlarm(): void {
  // Fire on the 1st of next month
  const now = new Date()
  const nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0)
  const delayMs = nextFirst.getTime() - now.getTime()

  chrome.alarms.create(PROFILE_REMINDER_ALARM, {
    delayInMinutes: delayMs / 60_000,
    periodInMinutes: 60 * 24 * 30, // ~monthly
  })
}

async function handleMonitorAlarm(): Promise<void> {
  const snoozed = await isMonitorSnoozed()
  if (snoozed) return

  const { saved_searches } = await get(['saved_searches'])
  const enabledSearches = (saved_searches ?? []).filter((s) => s.monitorEnabled)
  if (enabledSearches.length === 0) return

  const batchedHighScoreJobs: Array<{ title: string; score: number; url: string; reason: string }> = []

  for (const search of enabledSearches) {
    try {
      const jobs = await fetchJobsFromSearch(search.url)

      for (const job of jobs) {
        const alreadySeen = await hasSeenJob(job.jobId)
        if (alreadySeen) continue

        await markJobSeen(job.jobId)

        const result = await scoreJob(job)

        const jobIdHash = await hashJobId(job.jobId)
        await logEvent('jobs_scored', {
          job_id_hash: jobIdHash,
          score: result.score,
          budget_type: job.budget.type,
          saved_search_label: search.label,
        }).catch(console.warn)

        const config = await getNotificationConfig()
        if (result.score >= config.threshold) {
          if (config.batchingEnabled) {
            batchedHighScoreJobs.push({
              title: job.title,
              score: result.score,
              url: job.url,
              reason: result.oneLineReason,
            })
          } else {
            await fireJobNotification(job, result.score, result.oneLineReason)
          }
        }
      }
    } catch (err) {
      console.warn(`[Monitor] Error polling saved search "${search.label}":`, err)
    }
  }

  // Fire batched notification
  if (batchedHighScoreJobs.length > 0) {
    const config = await getNotificationConfig()
    if (isInQuietHours(config.quietHoursStart, config.quietHoursEnd)) return

    if (batchedHighScoreJobs.length === 1) {
      const j = batchedHighScoreJobs[0]
      await fireJobNotification({ title: j.title, url: j.url } as JobPost, j.score, j.reason)
    } else {
      const topScores = batchedHighScoreJobs
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((j) => `${j.score}/10 — ${truncate(j.title, 40)}`)
        .join('\n')

      chrome.notifications.create(`batch-${Date.now()}`, {
        type: 'basic',
        iconUrl: '../icons/icon48.png',
        title: `${batchedHighScoreJobs.length} new high-score jobs`,
        message: topScores,
      })
    }
  }

  // Reschedule with jitter
  const jitter = randomJitterMs()
  const { monitor_interval_minutes } = await get(['monitor_interval_minutes'])
  const intervalMs = (monitor_interval_minutes ?? 3) * 60_000
  chrome.alarms.create(`${ALARM_NAME}-reschedule-${Date.now()}`, {
    delayInMinutes: (intervalMs + jitter) / 60_000,
  })
}

async function fireJobNotification(job: Partial<JobPost> & { title: string; url: string }, score: number, reason: string): Promise<void> {
  const config = await getNotificationConfig()
  if (isInQuietHours(config.quietHoursStart, config.quietHoursEnd)) return

  const notifId = `job-${Date.now()}`
  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: '../icons/icon48.png',
    title: `Score ${score}/10 — ${truncate(job.title, 40)}`,
    message: reason,
    buttons: [{ title: 'View Job' }],
  })

  chrome.notifications.onButtonClicked.addListener((id, idx) => {
    if (id === notifId && idx === 0) {
      chrome.tabs.create({ url: job.url })
    }
  })
}

async function fetchJobsFromSearch(searchUrl: string): Promise<JobPost[]> {
  let resp: Response
  try {
    resp = await fetch(searchUrl, { credentials: 'include' })
  } catch {
    throw new Error(`Network error fetching saved search`)
  }

  // Detect logged-out state
  const finalUrl = resp.url
  if (finalUrl.includes('/login') || finalUrl.includes('/ab/account-security/login')) {
    chrome.notifications.create(`auth-${Date.now()}`, {
      type: 'basic',
      iconUrl: '../icons/icon48.png',
      title: 'SBS Copilot — Sign in required',
      message: 'Sign in to Upwork to resume job monitoring.',
    })
    return []
  }

  const html = await resp.text()
  return parseJobCardsFromHtml(html, searchUrl)
}

function parseJobCardsFromHtml(html: string, _baseUrl: string): JobPost[] {
  // Parse the raw HTML using a DOMParser to extract job card data.
  // This runs in the service worker which has DOMParser access in MV3.
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const jobs: JobPost[] = []

  // Upwork job cards in search results — selectors may need updating
  const cards = doc.querySelectorAll('[data-test="job-tile"], .job-tile, article[data-ev-job-uid]')

  cards.forEach((card) => {
    try {
      const jobId =
        card.getAttribute('data-ev-job-uid') ??
        card.getAttribute('data-job-id') ??
        card.querySelector('a[href*="/jobs/"]')?.getAttribute('href')?.match(/~([a-z0-9]+)/)?.[1] ??
        ''

      if (!jobId) return

      const titleEl = card.querySelector('[data-test="job-title"], h2 a, .job-title-link')
      const title = titleEl?.textContent?.trim() ?? 'Untitled'

      const jobPath = titleEl?.getAttribute('href') ?? `/jobs/~${jobId}`
      const url = new URL(jobPath, 'https://www.upwork.com').href

      const description = card.querySelector('[data-test="job-description-text"], .job-description')?.textContent?.trim() ?? ''

      const budgetEl = card.querySelector('[data-test="job-type"], [data-test="budget"]')
      const budgetText = budgetEl?.textContent?.trim() ?? ''
      const budget = parseBudgetText(budgetText)

      const skillEls = card.querySelectorAll('[data-test="attr-item"] span, .skill-badge')
      const skills = Array.from(skillEls).map((el) => el.textContent?.trim() ?? '').filter(Boolean)

      const postedEl = card.querySelector('time, [data-test="posted-on"]')
      const postedAt = postedEl?.getAttribute('datetime') ?? postedEl?.textContent?.trim()

      const proposalEl = card.querySelector('[data-test="proposals-tier"]')
      const proposalText = proposalEl?.textContent?.trim() ?? ''
      const proposalCount = parseInt(proposalText) || undefined

      jobs.push({
        jobId,
        url,
        title,
        description,
        skills,
        budget,
        client: { name: '', paymentVerified: false, proposalCount },
        postedAt,
        questions: [],
      })
    } catch {
      // Skip malformed cards silently
    }
  })

  return jobs
}

function parseBudgetText(text: string): JobBudget {
  if (!text) return { type: 'unknown' }

  const hourlyMatch = text.match(/\$(\d+(?:\.\d+)?)\s*[-–]\s*\$(\d+(?:\.\d+)?)/)
  if (hourlyMatch) {
    return { type: 'hourly', hourlyMin: parseFloat(hourlyMatch[1]), hourlyMax: parseFloat(hourlyMatch[2]) }
  }

  const singleHourly = text.match(/\$(\d+(?:\.\d+)?)\s*\/\s*hr/i)
  if (singleHourly) {
    const rate = parseFloat(singleHourly[1])
    return { type: 'hourly', hourlyMin: rate, hourlyMax: rate }
  }

  const fixedMatch = text.match(/\$(\d[\d,]*)/)
  if (fixedMatch) {
    return { type: 'fixed', fixed: parseFloat(fixedMatch[1].replace(/,/g, '')) }
  }

  return { type: 'unknown' }
}

async function handleProfileReminderAlarm(): Promise<void> {
  const { last_profile_analysis } = await get(['last_profile_analysis'])
  if (!last_profile_analysis) {
    chrome.notifications.create(`profile-reminder-${Date.now()}`, {
      type: 'basic',
      iconUrl: '../icons/icon48.png',
      title: 'SBS Copilot — Profile Reminder',
      message: "It's the 1st of the month! Consider re-analyzing your Upwork profile.",
      buttons: [{ title: 'Go to Profile' }],
    })
  }
}
