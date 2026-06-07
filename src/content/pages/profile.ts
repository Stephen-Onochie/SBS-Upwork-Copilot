import { SELECTORS } from '../selectors'
import { showToast } from '../ui/toast'

const BUTTON_ID = 'sbs-analyze-profile-btn'

export function initProfilePage(): void {
  if (document.getElementById(BUTTON_ID)) return

  // Try immediately
  if (profileContentReady()) {
    injectButton()
    return
  }

  // Watch for SPA render
  const observer = new MutationObserver(() => {
    if (profileContentReady() && !document.getElementById(BUTTON_ID)) {
      observer.disconnect()
      clearTimeout(fallback)
      injectButton()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Guaranteed fallback: inject after 3 s even if selectors never match.
  // We already know we're on a /freelancers/ URL — the button should always appear.
  const fallback = setTimeout(() => {
    observer.disconnect()
    if (!document.getElementById(BUTTON_ID)) injectButton()
  }, 3000)
}

function profileContentReady(): boolean {
  return !!(
    document.querySelector(SELECTORS.profile.title) ||
    document.querySelector(SELECTORS.profile.titleFallback)
  )
}

function injectButton(): void {
  if (document.getElementById(BUTTON_ID)) return

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.textContent = '🔍 Analyze Profile'
  btn.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 99999;
    background: #1C374C;
    color: #DDAD50;
    border: 2px solid #DDAD50;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    transition: opacity 0.15s;
  `
  btn.addEventListener('mouseover', () => { btn.style.opacity = '0.85' })
  btn.addEventListener('mouseout', () => { btn.style.opacity = '1' })
  btn.addEventListener('click', () => void handleAnalyzeClick(btn))
  document.body.appendChild(btn)
}

async function handleAnalyzeClick(btn: HTMLButtonElement): Promise<void> {
  btn.textContent = '⏳ Analyzing...'
  btn.disabled = true

  try {
    const rawText = scrapeProfileText()
    const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_PROFILE', rawText })

    if (!response.ok) throw new Error(response.error ?? 'Analysis failed')

    btn.textContent = '✅ Done!'
    showToast('Profile analyzed and saved successfully.', 'success')
    setTimeout(() => {
      btn.textContent = '🔍 Analyze Profile'
      btn.disabled = false
    }, 3000)
  } catch (err) {
    btn.textContent = '❌ Failed'
    showToast(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    setTimeout(() => {
      btn.textContent = '🔍 Analyze Profile'
      btn.disabled = false
    }, 3000)
  }
}

function scrapeProfileText(): string {
  const parts: string[] = []

  const getText = (selector: string): string =>
    document.querySelector(selector)?.textContent?.trim() ?? ''

  const getAll = (selector: string): string =>
    Array.from(document.querySelectorAll(selector))
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n')

  parts.push('=== PROFILE TITLE ===')
  parts.push(
    getText(SELECTORS.profile.title) ||
    getText(SELECTORS.profile.titleFallback) ||
    getText('h1') ||
    getText('[class*="title"]')
  )

  parts.push('\n=== OVERVIEW ===')
  parts.push(
    getText(SELECTORS.profile.overview) ||
    getText(SELECTORS.profile.overviewFallback) ||
    getText('[class*="overview"] p') ||
    getText('[class*="description"] p')
  )

  parts.push('\n=== HOURLY RATE ===')
  parts.push(
    getText(SELECTORS.profile.rate) ||
    getText('[class*="rate"]') ||
    getText('[class*="hourly"]')
  )

  parts.push('\n=== SKILLS ===')
  const skills = [
    ...Array.from(document.querySelectorAll(SELECTORS.profile.skills)),
    ...Array.from(document.querySelectorAll('[class*="skill"]')),
  ]
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
  parts.push([...new Set(skills)].join(', '))

  parts.push('\n=== WORK HISTORY ===')
  parts.push(getAll(SELECTORS.profile.workHistoryItems) || getAll('[class*="work-history"] li'))

  parts.push('\n=== EMPLOYMENT ===')
  parts.push(getAll(SELECTORS.profile.employmentItems) || getAll('[class*="employment"] li'))

  parts.push('\n=== EDUCATION ===')
  parts.push(getAll(SELECTORS.profile.educationItems) || getAll('[class*="education"] li'))

  parts.push('\n=== PORTFOLIO ===')
  parts.push(getAll(SELECTORS.profile.portfolioItems) || getAll('[class*="portfolio"] li'))

  // Last-resort: grab meaningful text from the main content area
  const body = parts.join('\n').replace(/\s+/g, ' ').trim()
  if (body.length < 200) {
    const mainEl = document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body
    parts.push('\n=== PAGE TEXT (fallback) ===')
    parts.push(mainEl.innerText.slice(0, 8000))
  }

  return parts.join('\n').slice(0, 15000)
}
