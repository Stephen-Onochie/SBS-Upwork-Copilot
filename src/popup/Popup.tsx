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
    <div className="w-80 bg-white">
      {/* Header */}
      <div className="bg-upwork-green p-4 text-white">
        <h1 className="text-lg font-bold">SBS Upwork Co-Pilot</h1>
        <p className="text-sm opacity-80">Personal assistant for Stephen @ SBS Digital</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Gemini key warning */}
        {!state.geminiKeySet && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            ⚠️ Gemini API key not configured.{' '}
            <button onClick={openOptions} className="underline font-semibold">
              Open Settings
            </button>
          </div>
        )}

        {/* Profile staleness */}
        {profileStale && (
          <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
            🔔 Profile last analyzed {state.profileAge} days ago.{' '}
            <button onClick={openUpworkProfile} className="underline font-semibold">
              Re-analyze
            </button>
          </div>
        )}

        {/* Status rows */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Job Monitor</span>
            <span className={`font-semibold ${state.monitorActive ? 'text-green-600' : 'text-gray-400'}`}>
              {state.monitorActive ? (isSnoozed ? '⏸ Snoozed' : '● Active') : '○ Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Profile Age</span>
            <span className={`font-semibold ${profileStale ? 'text-orange-600' : 'text-gray-800'}`}>
              {state.profileAge !== null ? `${state.profileAge}d ago` : 'Never analyzed'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={toggleSnooze}
            disabled={!state.monitorActive}
            className="w-full py-2 px-3 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSnoozed ? '▶ Resume Monitoring' : '⏸ Snooze 1 Hour'}
          </button>
          <button
            onClick={openOptions}
            className="w-full py-2 px-3 text-sm font-medium bg-upwork-green text-white hover:opacity-90 rounded-lg"
          >
            ⚙️ Open Settings
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 text-center text-xs text-gray-400">
        Monitoring pauses when browser closes
      </div>
    </div>
  )
}
