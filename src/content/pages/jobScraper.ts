import type { JobPost, JobBudget, ClientInfo, ScreeningQuestion } from '@/lib/types'
import { SELECTORS } from '../selectors'

export function scrapeJobPost(): JobPost {
  const getText = (selector: string): string =>
    document.querySelector(selector)?.textContent?.trim() ?? ''

  const jobId = extractJobId()
  const url = window.location.href
  const title = getText(SELECTORS.jobPost.title)
  const description = getText(SELECTORS.jobPost.description)

  const skills = Array.from(document.querySelectorAll(SELECTORS.jobPost.skills))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)

  const budget = parseBudget()
  const client = parseClient()
  const questions = scrapeScreeningQuestions()

  const postedEl = document.querySelector(SELECTORS.jobPost.postedAt)
  const postedAt = postedEl?.getAttribute('datetime') ?? postedEl?.textContent?.trim()

  return { jobId, url, title, description, skills, budget, client, postedAt, questions }
}

function extractJobId(): string {
  const match = window.location.pathname.match(/~([a-z0-9]+)/i)
  return match?.[1] ?? window.location.pathname.split('/').pop() ?? ''
}

function parseBudget(): JobBudget {
  const hourlyText = document.querySelector(SELECTORS.jobPost.budgetHourly)?.textContent?.trim() ?? ''
  const fixedText = document.querySelector(SELECTORS.jobPost.budgetFixed)?.textContent?.trim() ?? ''

  // Try hourly range first
  const rangeMatch = hourlyText.match(/\$(\d+(?:\.\d+)?)\s*[-–]\s*\$(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    return { type: 'hourly', hourlyMin: parseFloat(rangeMatch[1]), hourlyMax: parseFloat(rangeMatch[2]) }
  }

  const singleHourly = hourlyText.match(/\$(\d+(?:\.\d+)?)/)
  if (singleHourly && hourlyText.toLowerCase().includes('hr')) {
    const rate = parseFloat(singleHourly[1])
    return { type: 'hourly', hourlyMin: rate, hourlyMax: rate }
  }

  // Try fixed price
  const fixedMatch = fixedText.match(/\$(\d[\d,]*)/)
  if (fixedMatch) {
    return { type: 'fixed', fixed: parseFloat(fixedMatch[1].replace(/,/g, '')) }
  }

  // Check all budget-related text on the page
  const allBudgetText = document.body.textContent ?? ''
  const budgetSection = allBudgetText.match(/\$([\d,]+(?:\.\d+)?)\s*[-–]\s*\$([\d,]+(?:\.\d+)?)\s*\/?\s*hr/i)
  if (budgetSection) {
    return {
      type: 'hourly',
      hourlyMin: parseFloat(budgetSection[1].replace(/,/g, '')),
      hourlyMax: parseFloat(budgetSection[2].replace(/,/g, '')),
    }
  }

  return { type: 'unknown' }
}

function parseClient(): ClientInfo {
  const getText = (selector: string): string =>
    document.querySelector(selector)?.textContent?.trim() ?? ''

  const ratingText = getText(SELECTORS.jobPost.clientRating)
  const rating = parseFloat(ratingText) || undefined

  const hireRateText = getText(SELECTORS.jobPost.clientHireRate)
  const hireRateMatch = hireRateText.match(/(\d+)%/)
  const hireRate = hireRateMatch ? parseInt(hireRateMatch[1]) : undefined

  const proposalText = getText(SELECTORS.jobPost.proposalCount)
  const proposalCount = parseInt(proposalText) || undefined

  const paymentVerifiedEl = document.querySelector(SELECTORS.jobPost.clientPaymentVerified)
  const paymentVerified = paymentVerifiedEl !== null

  return {
    name: getText(SELECTORS.jobPost.clientName),
    rating,
    hireRate,
    totalSpent: getText(SELECTORS.jobPost.clientTotalSpent),
    paymentVerified,
    proposalCount,
  }
}

function scrapeScreeningQuestions(): ScreeningQuestion[] {
  const questionEls = document.querySelectorAll(SELECTORS.apply.screeningQuestion)
  return Array.from(questionEls).map((el, i) => ({
    id: `q${i}`,
    text: el.textContent?.trim() ?? '',
  })).filter((q) => q.text)
}
