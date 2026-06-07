import { SELECTORS } from '../selectors'
import { scrapeJobPost } from './jobScraper'
import { showToast } from '../ui/toast'
import { mountProposalPanel } from '../ui/proposalPanel'
import { mountUnicodeToolbar } from '../ui/unicodeToolbar'

const GENERATE_BTN_ID = 'sbs-apply-generate-btn'
const DRAFT_MARKER_ID = 'sbs-draft-marker'

export function initApplyPage(): void {
  if (document.getElementById(GENERATE_BTN_ID)) return

  waitForTextarea(() => {
    injectGenerateButton()
    injectUnicodeToolbar()
    normalizeConnects()
    watchSubmitButton()
  })
}

function waitForTextarea(callback: () => void, timeout = 15000): void {
  const el = document.querySelector(SELECTORS.apply.coverLetterTextarea)
  if (el) { callback(); return }

  const observer = new MutationObserver(() => {
    if (document.querySelector(SELECTORS.apply.coverLetterTextarea)) {
      observer.disconnect()
      callback()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), timeout)
}

function injectGenerateButton(): void {
  if (document.getElementById(GENERATE_BTN_ID)) return

  const textarea = document.querySelector<HTMLTextAreaElement>(SELECTORS.apply.coverLetterTextarea)
  if (!textarea) return

  const btn = document.createElement('button')
  btn.id = GENERATE_BTN_ID
  btn.type = 'button'
  btn.textContent = '✍️ Generate Proposal'
  btn.style.cssText = `
    display: block;
    margin-bottom: 8px;
    background: #14a800;
    color: white;
    border: none;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `

  btn.addEventListener('click', () => void handleGenerateClick(btn))
  textarea.parentElement?.insertBefore(btn, textarea)
}

async function handleGenerateClick(btn: HTMLButtonElement): Promise<void> {
  btn.textContent = '⏳ Generating...'
  btn.disabled = true

  try {
    const jobPost = scrapeJobPost()
    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_PROPOSAL', jobPost })

    if (!response.ok) throw new Error(response.error ?? 'Generation failed')

    const proposalText = response.data as string
    const textarea = document.querySelector<HTMLTextAreaElement>(SELECTORS.apply.coverLetterTextarea)

    if (textarea) {
      fillTextarea(textarea, proposalText)
      showDraftMarker(textarea)
    }

    mountProposalPanel(proposalText, async () => {
      // Regenerate callback
      const resp = await chrome.runtime.sendMessage({ type: 'GENERATE_PROPOSAL', jobPost })
      if (resp.ok && textarea) {
        fillTextarea(textarea, resp.data as string)
      }
      return resp.data as string
    })

    // Also inject per-question draft buttons
    injectQuestionDraftButtons(jobPost)
  } catch (err) {
    showToast(`Generation failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
  } finally {
    btn.textContent = '✍️ Generate Proposal'
    btn.disabled = false
  }
}

export function fillTextarea(textarea: HTMLTextAreaElement, text: string): void {
  textarea.focus()
  textarea.value = text
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.dispatchEvent(new Event('change', { bubbles: true }))
  // React compatibility
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function showDraftMarker(textarea: HTMLTextAreaElement): void {
  const existing = document.getElementById(DRAFT_MARKER_ID)
  if (existing) existing.remove()

  const marker = document.createElement('div')
  marker.id = DRAFT_MARKER_ID
  marker.textContent = '✅ Draft inserted — review before sending'
  marker.style.cssText = `
    background: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #a5d6a7;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    margin-top: 4px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `
  textarea.parentElement?.insertBefore(marker, textarea.nextSibling)

  setTimeout(() => marker.remove(), 10000)
}

function injectUnicodeToolbar(): void {
  const textarea = document.querySelector<HTMLTextAreaElement>(SELECTORS.apply.coverLetterTextarea)
  if (!textarea) return
  mountUnicodeToolbar(textarea)
}

function normalizeConnects(): void {
  try {
    const baseEl = document.querySelector(SELECTORS.apply.connectsBase)
    if (!baseEl) return

    const baseText = baseEl.textContent?.trim() ?? ''
    const baseMatch = baseText.match(/(\d+)/)
    if (!baseMatch) return

    const baseCost = parseInt(baseMatch[1])
    chrome.storage.local.get(['connects_target', 'connects_normalizer_enabled'], (result) => {
      try {
        if (!result.connects_normalizer_enabled) return

        const target = (result.connects_target as number | undefined) ?? 20
        const boost = Math.max(0, target - baseCost)

        const boostInput = document.querySelector<HTMLInputElement>(SELECTORS.apply.connectsBoostInput)
        if (!boostInput) return

        boostInput.value = String(boost)
        boostInput.dispatchEvent(new Event('input', { bubbles: true }))
        boostInput.dispatchEvent(new Event('change', { bubbles: true }))
      } catch (innerErr) {
        console.warn('[SBS Copilot] Connects normalizer inner error:', innerErr)
      }
    })
  } catch (err) {
    console.warn('[SBS Copilot] Connects normalizer failed (non-fatal):', err)
  }
}

function watchSubmitButton(): void {
  const submitBtn = document.querySelector<HTMLButtonElement>(SELECTORS.apply.submitButton)
  if (!submitBtn) return

  // Observation only — never trigger this click, only observe
  submitBtn.addEventListener('click', () => {
    try {
      const jobPost = scrapeJobPost()
      const boostInput = document.querySelector<HTMLInputElement>(SELECTORS.apply.connectsBoostInput)
      const boostVal = boostInput ? parseInt(boostInput.value) || 0 : 0
      const baseCost = parseInt(
        document.querySelector(SELECTORS.apply.connectsBase)?.textContent?.match(/(\d+)/)?.[1] ?? '0'
      ) || 0

      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'LOG_PROPOSAL_SENT',
          jobId: jobPost.jobId,
          jobTitle: jobPost.title,
          connectsBid: baseCost + boostVal,
        })
      }, 500)
    } catch (err) {
      console.warn('[SBS Copilot] Submit detection error:', err)
    }
  })
}

function injectQuestionDraftButtons(jobPost: ReturnType<typeof scrapeJobPost>): void {
  jobPost.questions.forEach((question) => {
    const questionEls = document.querySelectorAll(SELECTORS.apply.screeningQuestion)
    questionEls.forEach((el) => {
      if (!el.textContent?.includes(question.text.slice(0, 30))) return
      if (el.querySelector('.sbs-draft-answer-btn')) return

      const draftBtn = document.createElement('button')
      draftBtn.className = 'sbs-draft-answer-btn'
      draftBtn.type = 'button'
      draftBtn.textContent = '💡 Draft Answer'
      draftBtn.style.cssText = `
        display: inline-block;
        margin-top: 4px;
        background: #f0faf0;
        color: #14a800;
        border: 1px solid #14a800;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      `

      draftBtn.addEventListener('click', async () => {
        draftBtn.textContent = '⏳ Drafting...'
        draftBtn.disabled = true
        try {
          const resp = await chrome.runtime.sendMessage({
            type: 'GENERATE_QUESTION_ANSWER',
            question,
            jobPost,
          })
          if (resp.ok) {
            mountProposalPanel(resp.data as string, null)
          } else {
            showToast(`Draft failed: ${resp.error}`, 'error')
          }
        } finally {
          draftBtn.textContent = '💡 Draft Answer'
          draftBtn.disabled = false
        }
      })

      el.appendChild(draftBtn)
    })
  })
}
