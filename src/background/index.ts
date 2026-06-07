import { handleMessage } from './messages'
import { initMonitor } from './monitor'

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SBS Copilot] Extension installed/updated')
  initMonitor()
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[SBS Copilot] Browser started')
  initMonitor()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message, sendResponse)
  return true // keep channel open for async response
})
