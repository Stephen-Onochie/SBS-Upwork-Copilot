const TOOLBAR_ID = 'sbs-unicode-toolbar'

// Unicode Mathematical Bold range offset: A=𝐀 (U+1D400), a=𝐚 (U+1D41A)
const BOLD_UPPER_OFFSET = 0x1D400 - 0x41
const BOLD_LOWER_OFFSET = 0x1D41A - 0x61

// Unicode Mathematical Italic range: A=𝐴 (U+1D434), a=𝑎 (U+1D44E)
const ITALIC_UPPER_OFFSET = 0x1D434 - 0x41
const ITALIC_LOWER_OFFSET = 0x1D44E - 0x61

function toBoldUnicode(text: string): string {
  return Array.from(text).map((char) => {
    const code = char.charCodeAt(0)
    if (code >= 0x41 && code <= 0x5A) return String.fromCodePoint(code + BOLD_UPPER_OFFSET) // A-Z
    if (code >= 0x61 && code <= 0x7A) return String.fromCodePoint(code + BOLD_LOWER_OFFSET) // a-z
    return char
  }).join('')
}

function toItalicUnicode(text: string): string {
  return Array.from(text).map((char) => {
    const code = char.charCodeAt(0)
    if (code >= 0x41 && code <= 0x5A) return String.fromCodePoint(code + ITALIC_UPPER_OFFSET)
    if (code >= 0x61 && code <= 0x7A) return String.fromCodePoint(code + ITALIC_LOWER_OFFSET)
    return char
  }).join('')
}

function toBulletList(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim() ? `▸ ${line.trim()}` : line)
    .join('\n')
}

function applyTransform(textarea: HTMLTextAreaElement, transform: (text: string) => string): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)

  if (!selected) return

  const transformed = transform(selected)
  const newValue = textarea.value.slice(0, start) + transformed + textarea.value.slice(end)
  textarea.value = newValue
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.setSelectionRange(start, start + transformed.length)
  textarea.focus()
}

export function mountUnicodeToolbar(textarea: HTMLTextAreaElement): void {
  if (document.getElementById(TOOLBAR_ID)) return

  const toolbar = document.createElement('div')
  toolbar.id = TOOLBAR_ID
  toolbar.style.cssText = `
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `

  const buttons: Array<{ label: string; title: string; action: () => void }> = [
    {
      label: '𝐁',
      title: 'Bold (Unicode)',
      action: () => applyTransform(textarea, toBoldUnicode),
    },
    {
      label: '𝐼',
      title: 'Italic (Unicode)',
      action: () => applyTransform(textarea, toItalicUnicode),
    },
    {
      label: '▸',
      title: 'Bullet list',
      action: () => applyTransform(textarea, toBulletList),
    },
    {
      label: '•',
      title: 'Bullet points (•)',
      action: () => applyTransform(textarea, (t) => t.split('\n').map((l) => l.trim() ? `• ${l.trim()}` : l).join('\n')),
    },
  ]

  buttons.forEach(({ label, title, action }) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    btn.title = title
    btn.style.cssText = `
      width: 32px; height: 28px; background: white; border: 1px solid #dee2e6;
      border-radius: 4px; font-size: 14px; cursor: pointer; display: flex;
      align-items: center; justify-content: center; padding: 0;
    `
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      action()
    })
    toolbar.appendChild(btn)
  })

  // Emoji picker button
  const emojiBtn = document.createElement('button')
  emojiBtn.type = 'button'
  emojiBtn.textContent = '😊'
  emojiBtn.title = 'Common emojis'
  emojiBtn.style.cssText = `
    width: 32px; height: 28px; background: white; border: 1px solid #dee2e6;
    border-radius: 4px; font-size: 14px; cursor: pointer; position: relative;
  `

  const COMMON_EMOJIS = ['✅', '🚀', '💡', '⚡', '🎯', '📊', '🔧', '💼', '🌟', '🤝']
  let emojiPickerEl: HTMLDivElement | null = null

  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault()
    if (emojiPickerEl) {
      emojiPickerEl.remove()
      emojiPickerEl = null
      return
    }

    const picker = document.createElement('div')
    picker.style.cssText = `
      position: absolute; z-index: 99999; background: white; border: 1px solid #ddd;
      border-radius: 6px; padding: 8px; display: flex; flex-wrap: wrap; gap: 4px;
      width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `

    COMMON_EMOJIS.forEach((emoji) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = emoji
      btn.style.cssText = 'font-size: 18px; background: none; border: none; cursor: pointer; padding: 2px;'
      btn.addEventListener('click', () => {
        const pos = textarea.selectionStart
        textarea.value = textarea.value.slice(0, pos) + emoji + textarea.value.slice(pos)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.setSelectionRange(pos + emoji.length, pos + emoji.length)
        textarea.focus()
        picker.remove()
        emojiPickerEl = null
      })
      picker.appendChild(btn)
    })

    emojiPickerEl = picker
    document.body.appendChild(picker)
    const rect = emojiBtn.getBoundingClientRect()
    picker.style.top = `${rect.bottom + 4 + window.scrollY}px`
    picker.style.left = `${rect.left + window.scrollX}px`
  })

  toolbar.appendChild(emojiBtn)
  textarea.parentElement?.insertBefore(toolbar, textarea)
}
