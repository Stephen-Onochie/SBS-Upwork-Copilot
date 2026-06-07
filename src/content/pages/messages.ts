import { SELECTORS } from '../selectors'
import { showToast } from '../ui/toast'

const BUTTON_ID = 'sbs-hubspot-sync-btn'

export function initMessagesPage(): void {
  if (document.getElementById(BUTTON_ID)) return

  // Wait for message content to load
  const observer = new MutationObserver(() => {
    if (document.querySelector(SELECTORS.messages.clientName)) {
      observer.disconnect()
      injectSyncButton()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  if (document.querySelector(SELECTORS.messages.clientName)) {
    injectSyncButton()
  }
}

function injectSyncButton(): void {
  if (document.getElementById(BUTTON_ID)) return

  const btn = document.createElement('button')
  btn.id = BUTTON_ID
  btn.type = 'button'
  btn.textContent = '🔗 Sync to HubSpot'
  btn.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 99999;
    background: #ff7a59;
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

  btn.addEventListener('click', () => void handleSyncClick(btn))
  document.body.appendChild(btn)
}

async function handleSyncClick(btn: HTMLButtonElement): Promise<void> {
  btn.textContent = '⏳ Syncing...'
  btn.disabled = true

  try {
    const getText = (selector: string): string =>
      document.querySelector(selector)?.textContent?.trim() ?? ''

    const clientName = getText(SELECTORS.messages.clientName) || 'Unknown Client'
    const company = getText(SELECTORS.messages.clientCompany) || undefined
    const jobTitle = getText(SELECTORS.messages.jobTitle) || undefined

    // Grab a snippet of the conversation for context
    const messageEls = document.querySelectorAll('[data-test="message-bubble"], .message-body')
    const jobContext = Array.from(messageEls)
      .slice(-5)
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n')
      .slice(0, 1000)

    const response = await chrome.runtime.sendMessage({
      type: 'SYNC_HUBSPOT',
      clientName,
      company,
      jobTitle,
      jobContext,
    })

    if (!response.ok) throw new Error(response.error ?? 'Sync failed')

    const { stage, action } = response.data as { stage: string; action: string }
    showToast(`HubSpot ${action}: Contact + Deal created (Stage: ${stage})`, 'success')

    btn.textContent = '✅ Synced!'
    setTimeout(() => {
      btn.textContent = '🔗 Sync to HubSpot'
      btn.disabled = false
    }, 3000)
  } catch (err) {
    showToast(`HubSpot sync failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    btn.textContent = '🔗 Sync to HubSpot'
    btn.disabled = false
  }
}
