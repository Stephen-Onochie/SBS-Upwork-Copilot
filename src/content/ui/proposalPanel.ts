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
    background: rgba(28,55,76,0.6);
    z-index: 999998;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  `

  const panel = document.createElement('div')
  panel.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 0;
    width: 680px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(28,55,76,0.25);
    overflow: hidden;
  `

  const header = document.createElement('div')
  header.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    background: #1C374C; padding: 16px 20px;
    border-bottom: 2px solid #DDAD50;
  `

  const title = document.createElement('h2')
  title.textContent = 'Generated Proposal'
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 700; color: #ffffff;'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.type = 'button'
  closeBtn.style.cssText = `
    background: none; border: none; font-size: 18px; cursor: pointer; color: #E1D8B3; padding: 0; line-height: 1;
  `
  closeBtn.addEventListener('click', () => overlay.remove())

  header.appendChild(title)
  header.appendChild(closeBtn)

  const body = document.createElement('div')
  body.style.cssText = 'padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow: auto; flex: 1;'

  const notice = document.createElement('div')
  notice.textContent = '✅ Draft inserted — review carefully before sending. Never click Submit automatically.'
  notice.style.cssText = `
    background: #F7F5EF; color: #1C374C; border: 1px solid #DDAD50;
    padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  `

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = `
    width: 100%; min-height: 280px; padding: 12px; border: 1px solid #E0DDD5;
    border-radius: 6px; font-size: 14px; line-height: 1.6; resize: vertical;
    box-sizing: border-box; font-family: inherit; outline: none;
  `
  textarea.addEventListener('focus', () => { textarea.style.borderColor = '#DDAD50' })
  textarea.addEventListener('blur', () => { textarea.style.borderColor = '#E0DDD5' })

  const actions = document.createElement('div')
  actions.style.cssText = 'display: flex; gap: 8px;'

  const copyBtn = document.createElement('button')
  copyBtn.textContent = '📋 Copy to Clipboard'
  copyBtn.type = 'button'
  copyBtn.style.cssText = `
    padding: 8px 16px; background: #1C374C; color: white; border: none;
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
      padding: 8px 16px; background: #DDAD50; color: #1C374C; border: none;
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

  body.appendChild(notice)
  body.appendChild(textarea)
  body.appendChild(actions)
  panel.appendChild(header)
  panel.appendChild(body)
  overlay.appendChild(panel)

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  document.body.appendChild(overlay)
}
