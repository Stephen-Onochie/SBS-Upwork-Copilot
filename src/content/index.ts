import { initProfilePage } from './pages/profile'
import { initJobPostPage } from './pages/jobPost'
import { initApplyPage } from './pages/apply'
import { initMessagesPage } from './pages/messages'

function route(): void {
  const path = window.location.pathname

  if (isOwnProfilePage(path)) {
    initProfilePage()
  } else if (isJobPostPage(path)) {
    initJobPostPage()
  } else if (isApplyPage(path)) {
    initApplyPage()
  } else if (isMessagesPage(path)) {
    initMessagesPage()
  } else if (isSavedSearchesPage(path)) {
    initSavedSearchesDiscovery()
  }
}

function isOwnProfilePage(path: string): boolean {
  return path.startsWith('/freelancers/')
}

function isJobPostPage(path: string): boolean {
  return /\/jobs\/~/.test(path) && !path.includes('/apply')
}

function isApplyPage(path: string): boolean {
  return path.includes('/apply') || path.includes('/proposal')
}

function isMessagesPage(path: string): boolean {
  return path.startsWith('/messages/')
}

function isSavedSearchesPage(path: string): boolean {
  return path.includes('/find-work/saved') || path.includes('/find-work')
}

function initSavedSearchesDiscovery(): void {
  // Read saved searches from the DOM and send to worker for storage
  const observer = new MutationObserver(() => {
    const items = document.querySelectorAll('[data-test="saved-search-item"]')
    if (items.length === 0) return

    observer.disconnect()

    const searches = Array.from(items).map((item) => {
      const label = item.querySelector('[data-test="saved-search-name"]')?.textContent?.trim() ?? 'Saved Search'
      const link = item.querySelector('a')?.getAttribute('href') ?? ''
      const id = link.match(/saved-searches\/([^/?]+)/)?.[1] ?? label.replace(/\s+/g, '-').toLowerCase()
      return {
        id,
        label,
        url: link.startsWith('http') ? link : `https://www.upwork.com${link}`,
      }
    })

    if (searches.length > 0) {
      chrome.runtime.sendMessage({ type: 'DISCOVER_SAVED_SEARCHES', searches })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Also try immediately
  setTimeout(() => {
    const items = document.querySelectorAll('[data-test="saved-search-item"]')
    if (items.length > 0) observer.disconnect()
  }, 3000)
}

// Run on initial load
route()

// Re-route on Upwork's SPA navigation
let lastPath = window.location.pathname
const navObserver = new MutationObserver(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname
    route()
  }
})
navObserver.observe(document.body, { childList: true, subtree: true })
