import React, { useEffect, useState } from 'react'

interface PopupState {
  profileAge: number | null   // days since last analysis
  monitorActive: boolean
  snoozedUntil: number | null
  geminiKeySet: boolean
}

export function Popup(): React.ReactElement {
  const [state, setState] = useState<PopupState>({
    profileAge: null,
    monitorActive: false,
    snoozedUntil: null,
    geminiKeySet: false,
  })

  useEffect(() => {
    chrome.storage.local.get(
      ['last_profile_analysis', 'monitor_snoozed_until', 'gemini_api_key', 'saved_searches'],
      (result) => {
        const lastAnalysis = result.last_profile_analysis as string | undefined
        const profileAge = lastAnalysis
          ? Math.floor((Date.now() - new Date(lastAnalysis).getTime()) / (1000 * 60 * 60 * 24))
          : null

        const snoozedUntil = (result.monitor_snoozed_until as number | undefined) ?? null
        const searches = (result.saved_searches as Array<{ monitorEnabled: boolean }> | undefined) ?? []
        const monitorActive = searches.some((s) => s.monitorEnabled)

        setState({
          profileAge,
          monitorActive,
          snoozedUntil,
          geminiKeySet: !!(result.gemini_api_key),
        })
      }
    )
  }, [])

  const profileStale = state.profileAge !== null && state.profileAge > 35
  const isSnoozed = state.snoozedUntil !== null && Date.now() < state.snoozedUntil

  function openOptions(): void {
    chrome.runtime.openOptionsPage()
  }

  function openUpworkProfile(): void {
    chrome.tabs.create({ url: 'https://www.upwork.com/freelancers/~' })
  }

  function toggleSnooze(): void {
    const snoozeUntil = isSnoozed ? null : Date.now() + 60 * 60 * 1000
    chrome.storage.local.set({ monitor_snoozed_until: snoozeUntil }, () => {
      setState((s) => ({ ...s, snoozedUntil: snoozeUntil }))
    })
  }

  return (
    <div className="w-80 bg-sbs-offwhite font-sans">
      {/* Header — Navy with gold accent bar */}
      <div className="bg-sbs-navy px-4 pt-4 pb-3 text-white border-b-2 border-sbs-gold">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sbs-gold font-mono text-xs font-bold tracking-widest uppercase">SBS</span>
          <span className="text-white/40 text-xs">|</span>
          <span className="text-white/80 text-xs font-medium">Upwork Co-Pilot</span>
        </div>
        <h1 className="text-base font-bold font-display leading-tight text-white">Stephen @ SBS Digital</h1>
        <p className="text-xs text-sbs-cream mt-0.5">Websites &amp; Automations That Convert</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Gemini key warning */}
        {!state.geminiKeySet && (
          <div className="bg-amber-50 border border-sbs-gold/40 rounded-lg p-3 text-sm text-sbs-navy">
            ⚠️ Gemini API key not configured.{' '}
            <button onClick={openOptions} className="underline font-semibold text-sbs-navy">
              Open Settings
            </button>
          </div>
        )}

        {/* Profile staleness */}
        {profileStale && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900">
            🔔 Profile last analyzed {state.profileAge} days ago.{' '}
            <button onClick={openUpworkProfile} className="underline font-semibold">
              Re-analyze
            </button>
          </div>
        )}

        {/* Status rows */}
        <div className="space-y-2 text-sm bg-white rounded-lg p-3 border border-sbs-border">
          <div className="flex items-center justify-between">
            <span className="text-sbs-gray">Job Monitor</span>
            <span className={`font-semibold ${state.monitorActive ? 'text-sbs-navy' : 'text-sbs-gray/60'}`}>
              {state.monitorActive
                ? (isSnoozed
                  ? <span className="text-amber-600">⏸ Snoozed</span>
                  : <span className="text-sbs-gold">● Active</span>)
                : '○ Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sbs-gray">Profile Age</span>
            <span className={`font-semibold ${profileStale ? 'text-amber-600' : 'text-sbs-navy'}`}>
              {state.profileAge !== null ? `${state.profileAge}d ago` : 'Never analyzed'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={toggleSnooze}
            disabled={!state.monitorActive}
            className="w-full py-2 px-3 text-sm font-medium bg-white border border-sbs-border text-sbs-navy hover:bg-sbs-offwhite rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSnoozed ? '▶ Resume Monitoring' : '⏸ Snooze 1 Hour'}
          </button>
          <button
            onClick={openOptions}
            className="w-full py-2 px-3 text-sm font-semibold bg-sbs-gold text-sbs-navy hover:bg-sbs-gold-light rounded-lg transition-colors"
          >
            ⚙️ Open Settings
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 text-center text-xs text-sbs-gray/60 border-t border-sbs-border pt-2">
        Monitoring pauses when browser closes
      </div>
    </div>
  )
}
