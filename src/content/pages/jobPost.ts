import { SELECTORS } from '../selectors'
import { scrapeJobPost } from './jobScraper'
import { showToast } from '../ui/toast'
import { mountProposalPanel } from '../ui/proposalPanel'

const BUTTON_ID = 'sbs-generate-proposal-btn'

export function initJobPostPage(): void {
  if (document.getElementById(BUTTON_ID)) return

  waitForElement(SELECTORS.jobPost.title, () => {
    injectGenerateButton()
  })
}

function injectGenerateButton(): void {
  if (document.getElementById(BUTTON_ID)) return

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.textContent = '✍️ Generate Proposal'
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

  btn.addEventListener('click', () => void handleGenerateClick(btn))
  document.body.appendChild(btn)
}

async function handleGenerateClick(btn: HTMLButtonElement): Promise<void> {
  btn.textContent = '⏳ Generating...'
  btn.disabled = true

  try {
    const jobPost = scrapeJobPost()
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_PROPOSAL', jobPost })

    if (!response.ok) throw new Error(response.error ?? 'Generation failed')

    const proposalText = response.data as string
    mountProposalPanel(proposalText, null)

    btn.textContent = '✍️ Generate Proposal'
    btn.disabled = false
  } catch (err) {
    showToast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    btn.textContent = '✍️ Generate Proposal'
    btn.disabled = false
  }
}

function waitForElement(selector: string, callback: () => void, timeout = 10000): void {
  const el = document.querySelector(selector)
  if (el) { callback(); return }

  const observer = new MutationObserver(() => {
    if (document.querySelector(selector)) {
      observer.disconnect()
      callback()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(() => observer.disconnect(), timeout)
}
