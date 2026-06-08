import React, { useEffect, useState } from 'react'
import type { SavedSearch } from '@/lib/types'

export function Monitor(): React.ReactElement {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [intervalMins, setIntervalMins] = useState(3)
  const [saved, setSaved] = useState(false)
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => {
    chrome.storage.local.get(['saved_searches', 'monitor_interval_minutes'], (result) => {
      setSearches((result.saved_searches as SavedSearch[] | undefined) ?? [])
      setIntervalMins((result.monitor_interval_minutes as number | undefined) ?? 3)
    })
  }, [])

  function toggleSearch(id: string): void {
    const updated = searches.map((s) =>
      s.id === id ? { ...s, monitorEnabled: !s.monitorEnabled } : s
    )
    setSearches(updated)
    chrome.storage.local.set({ saved_searches: updated })
  }

  function save(): void {
    chrome.storage.local.set({
      saved_searches: searches,
      monitor_interval_minutes: intervalMins,
    }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function addManualSearch(): void {
    const trimmed = manualUrl.trim()
    if (!trimmed) return
    const newSearch: SavedSearch = {
      id: `manual-${Date.now()}`,
      label: 'Manual Search',
      url: trimmed,
      monitorEnabled: true,
    }
    const updated = [...searches, newSearch]
    setSearches(updated)
    chrome.storage.local.set({ saved_searches: updated })
    setManualUrl('')
  }

  function openSavedSearches(): void {
    chrome.tabs.create({ url: 'https://www.upwork.com/nx/find-work/saved' })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-sbs-navy font-display">Job Monitor</h2>

      {saved && <div className="text-sm text-sbs-navy font-semibold">✅ Saved!</div>}

      <div className="bg-sbs-offwhite border border-sbs-gold/30 rounded-lg p-4 text-sm text-sbs-navy">
        ℹ️ Monitoring only runs while the Chrome browser is open. It is not a 24/7 background service.
      </div>

      {/* Interval */}
      <section className="space-y-2">
        <h3 className="font-semibold text-gray-800 text-sm">Poll Interval</h3>
        <div className="flex items-center gap-3">
          <input type="number" min={1} max={60} value={intervalMins}
            onChange={(e) => setIntervalMins(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20" />
          <span className="text-sm text-gray-600">minutes (±30–60s random jitter applied)</span>
        </div>
      </section>

      {/* Saved searches */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">
            Saved Searches ({searches.filter((s) => s.monitorEnabled).length} active)
          </h3>
          <button onClick={openSavedSearches}
            className="text-xs text-sbs-gold font-medium hover:underline">
            View on Upwork →
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-sbs-gray">
            If auto-discovery isn't working, paste a saved-search URL from Upwork below.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://www.upwork.com/nx/jobs/search/..."
              className="flex-1 rounded-lg border border-sbs-border px-3 py-2 text-sm text-sbs-navy bg-white focus:outline-none focus:ring-2 focus:ring-sbs-gold/40"
            />
            <button
              onClick={addManualSearch}
              disabled={!manualUrl.trim()}
              className="px-3 py-2 text-sm font-semibold bg-sbs-gold text-sbs-navy rounded-lg hover:bg-sbs-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {searches.length === 0 && (
          <div className="bg-sbs-offwhite border border-sbs-border rounded-lg p-4 text-sm text-sbs-gray">
            No saved searches discovered yet. Visit your Upwork saved searches page to sync them.
            <br />
            <button onClick={openSavedSearches} className="mt-2 text-sbs-gold hover:underline text-xs font-medium">
              Go to Saved Searches →
            </button>
          </div>
        )}

        <div className="space-y-2">
          {searches.map((search) => (
            <div key={search.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white">
              <div>
                <p className="text-sm font-medium text-gray-800">{search.label}</p>
                <p className="text-xs text-gray-400 truncate max-w-xs">{search.url}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">{search.monitorEnabled ? 'On' : 'Off'}</span>
                <div className="relative">
                  <input type="checkbox" checked={search.monitorEnabled}
                    onChange={() => toggleSearch(search.id)}
                    className="sr-only" />
                  <div onClick={() => toggleSearch(search.id)}
                    className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${
                      search.monitorEnabled ? 'bg-sbs-gold' : 'bg-sbs-border'
                    }`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 mx-0.5 transition-transform ${
                      search.monitorEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>
      </section>

      <button onClick={save}
        className="px-6 py-2 bg-sbs-gold text-sbs-navy font-semibold rounded-lg hover:bg-sbs-gold-light transition-colors">
        {saved ? '✅ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
