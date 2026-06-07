import { SELECTORS } from '../selectors'
import { showToast } from '../ui/toast'

const BUTTON_ID = 'sbs-analyze-profile-btn'

export function initProfilePage(): void {
  // Only inject once
  if (document.getElementById(BUTTON_ID)) return

  // Wait for profile content to load
  const observer = new MutationObserver(() => {
    if (document.querySelector(SELECTORS.profile.title) || document.querySelector(SELECTORS.profile.titleFallback)) {
      observer.disconnect()
      injectButton()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Also try immediately
  if (document.querySelector(SELECTORS.profile.title) || document.querySelector(SELECTORS.profile.titleFallback)) {
    injectButton()
  }
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
    background: #14a800;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `

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

    btn.textContent = '✅ Profile Analyzed!'
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

  parts.push('=== PROFILE TITLE ===')
  parts.push(getText(SELECTORS.profile.title) || getText(SELECTORS.profile.titleFallback))

  parts.push('\n=== OVERVIEW ===')
  parts.push(getText(SELECTORS.profile.overview) || getText(SELECTORS.profile.overviewFallback))

  parts.push('\n=== HOURLY RATE ===')
  parts.push(getText(SELECTORS.profile.rate))

  parts.push('\n=== SKILLS ===')
  const skills = Array.from(document.querySelectorAll(SELECTORS.profile.skills))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean)
  parts.push(skills.join(', '))

  parts.push('\n=== WORK HISTORY ===')
  document.querySelectorAll(SELECTORS.profile.workHistoryItems).forEach((item) => {
    parts.push(item.textContent?.trim() ?? '')
  })

  parts.push('\n=== EMPLOYMENT ===')
  document.querySelectorAll(SELECTORS.profile.employmentItems).forEach((item) => {
    parts.push(item.textContent?.trim() ?? '')
  })

  parts.push('\n=== EDUCATION ===')
  document.querySelectorAll(SELECTORS.profile.educationItems).forEach((item) => {
    parts.push(item.textContent?.trim() ?? '')
  })

  parts.push('\n=== PORTFOLIO ===')
  document.querySelectorAll(SELECTORS.profile.portfolioItems).forEach((item) => {
    parts.push(item.textContent?.trim() ?? '')
  })

  return parts.join('\n').slice(0, 15000) // Cap to avoid huge Gemini prompts
}
