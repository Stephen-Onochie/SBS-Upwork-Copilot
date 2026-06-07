import React, { useEffect, useState } from 'react'

interface PopupState {
  profileAge: number | null
  monitorActive: boolean
  snoozedUntil: number | null
  geminiKeySet: boolean
  currentTabUrl: string
}

type AnalyzeStatus = 'idle' | 'running' | 'ok' | 'error'

export function Popup(): React.ReactElement {
  const [state, setState] = useState<PopupState>({
    profileAge: null,
    monitorActive: false,
    snoozedUntil: null,
    geminiKeySet: false,
    currentTabUrl: '',
  })
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle')
  const [analyzeError, setAnalyzeError] = useState('')

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
        setState((s) => ({ ...s, profileAge, monitorActive, snoozedUntil, geminiKeySet: !!(result.gemini_api_key) }))
      }
    )

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setState((s) => ({ ...s, currentTabUrl: tabs[0]?.url ?? '' }))
    })
  }, [])

  const profileStale = state.profileAge !== null && state.profileAge > 35
  const isSnoozed = state.snoozedUntil !== null && Date.now() < state.snoozedUntil
  const onProfilePage = /upwork\.com\/(freelancers|profile)\//.test(state.currentTabUrl)

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

  async function analyzeProfile(): Promise<void> {
    setAnalyzeStatus('running')
    setAnalyzeError('')
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_AND_ANALYZE_PROFILE' })
      if (!response.ok) throw new Error(response.error ?? 'Analysis failed')
      setAnalyzeStatus('ok')
      setState((s) => ({ ...s, profileAge: 0 }))
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : String(err))
      setAnalyzeStatus('error')
    }
  }

  return (
    <div className="w-80 bg-sbs-offwhite font-sans">
      {/* Header */}
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
            Gemini API key not configured.{' '}
            <button onClick={openOptions} className="underline font-semibold">Open Settings</button>
          </div>
        )}

        {/* Profile staleness */}
        {profileStale && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900">
            Profile last analyzed {state.profileAge} days ago — re-analyze when ready.
          </div>
        )}

        {/* Status rows */}
        <div className="space-y-2 text-sm bg-white rounded-lg p-3 border border-sbs-border">
          <div className="flex items-center justify-between">
            <span className="text-sbs-gray">Job Monitor</span>
            <span className="font-semibold">
              {state.monitorActive
                ? (isSnoozed
                  ? <span className="text-amber-600">Snoozed</span>
                  : <span className="text-sbs-gold">Active</span>)
                : <span className="text-sbs-gray/60">Inactive</span>}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sbs-gray">Profile Age</span>
            <span className={`font-semibold ${profileStale ? 'text-amber-600' : 'text-sbs-navy'}`}>
              {state.profileAge !== null ? `${state.profileAge}d ago` : 'Never analyzed'}
            </span>
          </div>
        </div>

        {/* Analyze Profile */}
        <div className="bg-white rounded-lg p-3 border border-sbs-border space-y-2">
          <p className="text-xs text-sbs-gray">
            {onProfilePage
              ? 'Ready to analyze your profile.'
              : 'Navigate to your Upwork profile page first, then click below.'}
          </p>
          <button
            onClick={() => void analyzeProfile()}
            disabled={analyzeStatus === 'running'}
            className="w-full py-2 px-3 text-sm font-semibold bg-sbs-gold text-sbs-navy hover:bg-sbs-gold-light rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzeStatus === 'running' ? 'Analyzing...' : analyzeStatus === 'ok' ? 'Profile Analyzed!' : 'Analyze Profile'}
          </button>
          {analyzeStatus === 'error' && (
            <p className="text-xs text-red-600">{analyzeError}</p>
          )}
          {analyzeStatus === 'ok' && (
            <p className="text-xs text-green-600 font-medium">Profile saved successfully.</p>
          )}
          {!onProfilePage && (
            <button onClick={openUpworkProfile}
              className="w-full py-1.5 px-3 text-xs text-sbs-navy border border-sbs-border rounded-lg hover:bg-sbs-offwhite transition-colors">
              Open My Profile
            </button>
          )}
        </div>

        {/* Monitor snooze + settings */}
        <div className="flex flex-col gap-2">
          <button
            onClick={toggleSnooze}
            disabled={!state.monitorActive}
            className="w-full py-2 px-3 text-sm font-medium bg-white border border-sbs-border text-sbs-navy hover:bg-sbs-offwhite rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSnoozed ? 'Resume Monitoring' : 'Snooze 1 Hour'}
          </button>
          <button
            onClick={openOptions}
            className="w-full py-2 px-3 text-sm font-semibold bg-sbs-navy text-white hover:opacity-90 rounded-lg transition-colors"
          >
            Open Settings
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 text-center text-xs text-sbs-gray/60 border-t border-sbs-border pt-2">
        Monitoring pauses when browser closes
      </div>
    </div>
  )
}
