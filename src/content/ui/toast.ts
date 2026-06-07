const TOAST_CONTAINER_ID = 'sbs-toast-container'

function getContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = TOAST_CONTAINER_ID
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = getContainer()

  const toast = document.createElement('div')
  const colors = {
    success: { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#ef9a9a', text: '#c62828' },
    info: { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' },
  }
  const c = colors[type]

  toast.style.cssText = `
    background: ${c.bg};
    color: ${c.text};
    border: 1px solid ${c.border};
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    max-width: 320px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    animation: sbsFadeIn 0.2s ease;
  `
  toast.textContent = message
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}
