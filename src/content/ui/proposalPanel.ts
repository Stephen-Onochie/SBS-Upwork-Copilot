const PANEL_ID = 'sbs-proposal-panel'

export function mountProposalPanel(
  text: string,
  onRegenerate: (() => Promise<string>) | null
): void {
  const existing = document.getElementById(PANEL_ID)
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = PANEL_ID
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999998;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `

  const panel = document.createElement('div')
  panel.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 680px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  `

  const header = document.createElement('div')
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between;'

  const title = document.createElement('h2')
  title.textContent = 'Generated Proposal'
  title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a;'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.type = 'button'
  closeBtn.style.cssText = `
    background: none; border: none; font-size: 20px; cursor: pointer; color: #666; padding: 0;
  `
  closeBtn.addEventListener('click', () => overlay.remove())

  header.appendChild(title)
  header.appendChild(closeBtn)

  const notice = document.createElement('div')
  notice.textContent = '✅ Draft inserted — review carefully before sending. Never click Submit automatically.'
  notice.style.cssText = `
    background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7;
    padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;
  `

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = `
    width: 100%; min-height: 300px; padding: 12px; border: 1px solid #ddd;
    border-radius: 6px; font-size: 14px; line-height: 1.6; resize: vertical;
    box-sizing: border-box; font-family: inherit;
  `

  const actions = document.createElement('div')
  actions.style.cssText = 'display: flex; gap: 8px;'

  const copyBtn = document.createElement('button')
  copyBtn.textContent = '📋 Copy to Clipboard'
  copyBtn.type = 'button'
  copyBtn.style.cssText = `
    padding: 8px 16px; background: #1a1a1a; color: white; border: none;
    border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
  `
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(textarea.value).then(() => {
      copyBtn.textContent = '✅ Copied!'
      setTimeout(() => { copyBtn.textContent = '📋 Copy to Clipboard' }, 2000)
    })
  })

  actions.appendChild(copyBtn)

  if (onRegenerate) {
    const regenBtn = document.createElement('button')
    regenBtn.textContent = '🔄 Regenerate'
    regenBtn.type = 'button'
    regenBtn.style.cssText = `
      padding: 8px 16px; background: #14a800; color: white; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    `
    regenBtn.addEventListener('click', () => {
      regenBtn.textContent = '⏳ Regenerating...'
      regenBtn.disabled = true
      onRegenerate().then((newText) => {
        textarea.value = newText
        regenBtn.textContent = '🔄 Regenerate'
        regenBtn.disabled = false
      }).catch(() => {
        regenBtn.textContent = '🔄 Regenerate'
        regenBtn.disabled = false
      })
    })
    actions.appendChild(regenBtn)
  }

  panel.appendChild(header)
  panel.appendChild(notice)
  panel.appendChild(textarea)
  panel.appendChild(actions)
  overlay.appendChild(panel)

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  document.body.appendChild(overlay)
}
