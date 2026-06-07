import React, { useEffect, useRef, useState } from 'react'
import type { NotificationConfig } from '@/lib/types'
import { DEFAULT_NOTIFICATION_CONFIG } from '@/lib/storage'

const SOUNDS: Array<{ id: string; label: string }> = [
  { id: 'ding',    label: 'Ding'    },
  { id: 'chime',   label: 'Chime'   },
  { id: 'alert',   label: 'Alert'   },
  { id: 'bell',    label: 'Bell'    },
  { id: 'none',    label: 'Silent'  },
]

function playPreview(soundId: string, volume: number, ctxRef: React.MutableRefObject<AudioContext | null>): void {
  if (soundId === 'none' || volume === 0) return
  if (!ctxRef.current || ctxRef.current.state === 'closed') {
    ctxRef.current = new AudioContext()
  }
  const ctx = ctxRef.current
  const gain = ctx.createGain()
  gain.gain.value = volume / 100
  gain.connect(ctx.destination)

  const now = ctx.currentTime

  const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gain)
    gain.gain.setTargetAtTime(0, start + dur * 0.2, dur * 0.3)
    osc.start(start)
    osc.stop(start + dur + 0.3)
  }

  switch (soundId) {
    case 'ding':
      tone(880, now, 0.4)
      break
    case 'chime':
      tone(523, now, 0.35)
      tone(659, now + 0.2, 0.4)
      break
    case 'alert':
      tone(1000, now,       0.1, 'square')
      tone(1000, now + 0.15, 0.1, 'square')
      tone(1000, now + 0.3,  0.1, 'square')
      break
    case 'bell':
      tone(440, now, 0.8)
      tone(880, now, 0.3)
      break
  }
}

export function Notifications(): React.ReactElement {
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG)
  const [saved, setSaved] = useState(false)
  const audioCtx = useRef<AudioContext | null>(null)

  useEffect(() => {
    chrome.storage.local.get(['notification_config'], (result) => {
      if (result.notification_config) setConfig(result.notification_config as NotificationConfig)
    })
    return () => { audioCtx.current?.close() }
  }, [])

  function save(): void {
    chrome.storage.local.set({ notification_config: config }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleVolumeChange(value: number): void {
    setConfig((prev) => ({ ...prev, volume: value }))
    playPreview(config.sound, value, audioCtx)
  }

  function handleSoundChange(soundId: string): void {
    setConfig((prev) => ({ ...prev, sound: soundId }))
    playPreview(soundId, config.volume, audioCtx)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-sbs-navy font-display">Notifications</h2>

      {saved && <div className="text-sm text-sbs-navy font-semibold">Saved!</div>}

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
          <label className="block text-sm font-medium text-gray-700 mb-2">Notification Sound</label>
          <div className="flex flex-wrap gap-2">
            {SOUNDS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSoundChange(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  config.sound === s.id
                    ? 'bg-sbs-gold text-sbs-navy border-sbs-gold'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-sbs-gold hover:text-sbs-navy'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Click a sound to preview it at the current volume</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Volume: <span className="font-bold">{config.volume}%</span>
          </label>
          <input type="range" min={0} max={100} value={config.volume}
            onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
            className="w-full accent-[#DDAD50]" />
          <p className="text-xs text-gray-400 mt-1">Drag to preview the selected sound at this volume</p>
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
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
