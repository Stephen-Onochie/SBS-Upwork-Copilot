import type { ExtensionMessage, MessageResponse } from '@/lib/types'
import { analyzeProfile } from './profile'
import { generateProposal, generateQuestionAnswer } from './proposal'
import { scoreJob } from './scorer'
import { syncHubSpot } from './hubspot'
import { logProposalSent, signIn } from './supabase'
import { get, set } from '@/lib/storage'

export function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: MessageResponse) => void
): void {
  dispatch(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: Error) => sendResponse({ ok: false, error: err.message }))
}

async function dispatch(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'ANALYZE_PROFILE':
      return analyzeProfile(message.rawText)

    case 'GENERATE_PROPOSAL':
      return generateProposal(message.jobPost, message.templateId)

    case 'GENERATE_QUESTION_ANSWER':
      return generateQuestionAnswer(message.question, message.jobPost)

    case 'SCORE_JOB':
      return scoreJob(message.jobPost)

    case 'SYNC_HUBSPOT':
      return syncHubSpot(message)

    case 'LOG_PROPOSAL_SENT':
      return logProposalSent(message.jobId, message.jobTitle, message.connectsBid)

    case 'DISCOVER_SAVED_SEARCHES': {
      const { saved_searches } = await get(['saved_searches'])
      const existing = saved_searches ?? []
      const merged = message.searches.map((s) => {
        const found = existing.find((e) => e.id === s.id)
        return found ?? { ...s, monitorEnabled: false }
      })
      await set({ saved_searches: merged })
      return merged
    }

    case 'SCRAPE_AND_ANALYZE_PROFILE': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) throw new Error('No active tab found')
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeUpworkProfile,
      })
      const rawText = results[0]?.result as string | undefined
      if (!rawText || rawText.length < 100) {
        throw new Error('Could not read profile text — make sure you are on your Upwork profile page')
      }
      return analyzeProfile(rawText)
    }

    case 'TEST_GEMINI_KEY': {
      // Use the models list endpoint — no tokens, no rate-limit risk
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${message.apiKey}&pageSize=1`
      )
      if (!resp.ok) {
        const body = await resp.text()
        const msg = (() => {
          try { return (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body } catch { return body }
        })()
        if (resp.status === 429) throw new Error('Rate limited by Gemini — wait a moment and try again')
        if (resp.status === 400) throw new Error('Invalid API key format')
        if (resp.status === 403) throw new Error('API key rejected — check it has Generative Language API enabled')
        throw new Error(`Gemini API error ${resp.status}: ${msg.slice(0, 120)}`)
      }
      return { ok: true }
    }

    case 'SUPABASE_LOGIN':
      await signIn(message.email, message.password, message.supabaseUrl, message.supabaseAnonKey)
      return { ok: true }

    case 'TEST_HUBSPOT_TOKEN': {
      const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${message.token}` },
      })
      if (!resp.ok) throw new Error(`HubSpot API error: ${resp.status}`)
      return { ok: true }
    }

    default:
      throw new Error(`Unknown message type`)
  }
}

// Runs inside the Upwork tab via chrome.scripting.executeScript — NO imports allowed
function scrapeUpworkProfile(): string {
  const getText = (sel: string): string =>
    (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim() ?? ''

  const getAll = (sel: string): string =>
    Array.from(document.querySelectorAll(sel))
      .map((el) => (el as HTMLElement).innerText?.trim() ?? '')
      .filter(Boolean)
      .join('\n')

  const parts: string[] = []

  parts.push('=== PROFILE TITLE ===')
  parts.push(
    getText('[data-test="freelancer-title"]') ||
    getText('.freelancer-title') ||
    getText('h1') ||
    getText('[class*="title"]')
  )

  parts.push('\n=== OVERVIEW ===')
  parts.push(
    getText('[data-test="overview-text"]') ||
    getText('[class*="overview"] p') ||
    getText('[class*="description"] p')
  )

  parts.push('\n=== HOURLY RATE ===')
  parts.push(
    getText('[data-test="freelancer-rate"]') ||
    getText('[class*="rate"]') ||
    getText('[class*="hourly"]')
  )

  parts.push('\n=== SKILLS ===')
  const skills = Array.from(new Set([
    ...Array.from(document.querySelectorAll('[data-test="skill-badge"]')),
    ...Array.from(document.querySelectorAll('[class*="skill"]')),
  ].map((el) => (el as HTMLElement).innerText?.trim() ?? '').filter(Boolean)))
  parts.push(skills.join(', '))

  parts.push('\n=== WORK HISTORY ===')
  parts.push(getAll('[data-test="portfolio-item-card"]') || getAll('[class*="work-history"] li'))

  parts.push('\n=== EMPLOYMENT ===')
  parts.push(getAll('[data-test="employment-item"]') || getAll('[class*="employment"] li'))

  parts.push('\n=== EDUCATION ===')
  parts.push(getAll('[data-test="education-item"]') || getAll('[class*="education"] li'))

  parts.push('\n=== PORTFOLIO ===')
  parts.push(getAll('[data-test="portfolio-item"]') || getAll('[class*="portfolio"] li'))

  // Last-resort: grab all visible text from main content if structured data is thin
  const structured = parts.join('\n').replace(/\s+/g, ' ').trim()
  if (structured.length < 300) {
    const main = (document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body) as HTMLElement
    parts.push('\n=== PAGE TEXT (fallback) ===')
    parts.push(main.innerText.slice(0, 8000))
  }

  return parts.join('\n').slice(0, 15000)
}
