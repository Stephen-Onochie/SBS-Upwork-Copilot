import React, { useEffect, useState } from 'react'
import type { NotificationConfig } from '@/lib/types'
import { DEFAULT_NOTIFICATION_CONFIG } from '@/lib/storage'

export function Notifications(): React.ReactElement {
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['notification_config'], (result) => {
      if (result.notification_config) setConfig(result.notification_config as NotificationConfig)
    })
  }, [])

  function save(): void {
    chrome.storage.local.set({ notification_config: config }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-sbs-navy font-display">Notifications</h2>

      {saved && <div className="text-sm text-sbs-navy font-semibold">✅ Saved!</div>}

      <section className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-sbs-navy mb-2">
            Score Threshold: <span className="text-sbs-gold font-bold">{config.threshold}/10</span>
          </label>
          <input type="range" min={1} max={10} value={config.threshold}
            onChange={(e) => setConfig({ ...config, threshold: parseInt(e.target.value) })}
            className="w-full accent-[#DDAD50]" />
          <p className="text-xs text-gray-400 mt-1">Only notify for jobs scoring at or above this threshold</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={config.batchingEnabled}
              onChange={(e) => setConfig({ ...config, batchingEnabled: e.target.checked })} />
            <span className="text-gray-700">Batch multiple notifications (e.g. "5 new jobs ≥7")</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Volume: {config.volume}%</label>
          <input type="range" min={0} max={100} value={config.volume}
            onChange={(e) => setConfig({ ...config, volume: parseInt(e.target.value) })}
            className="w-full accent-[#DDAD50]" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours Start</label>
            <input type="time" value={config.quietHoursStart}
              onChange={(e) => setConfig({ ...config, quietHoursStart: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quiet Hours End</label>
            <input type="time" value={config.quietHoursEnd}
              onChange={(e) => setConfig({ ...config, quietHoursEnd: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="text-xs text-gray-400">No notifications will fire during quiet hours</p>
      </section>

      <button onClick={save}
        className="px-6 py-2 bg-sbs-gold text-sbs-navy font-semibold rounded-lg hover:bg-sbs-gold-light transition-colors">
        {saved ? '✅ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
