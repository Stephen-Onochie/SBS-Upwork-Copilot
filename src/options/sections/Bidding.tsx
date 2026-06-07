import React, { useEffect, useState } from 'react'

export function Bidding(): React.ReactElement {
  const [connectsTarget, setConnectsTarget] = useState(20)
  const [normalizerEnabled, setNormalizerEnabled] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['connects_target', 'connects_normalizer_enabled'], (result) => {
      if (result.connects_target) setConnectsTarget(result.connects_target as number)
      if (result.connects_normalizer_enabled !== undefined) {
        setNormalizerEnabled(result.connects_normalizer_enabled as boolean)
      }
    })
  }, [])

  function save(): void {
    chrome.storage.local.set({
      connects_target: connectsTarget,
      connects_normalizer_enabled: normalizerEnabled,
    }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const exampleBase = 13
  const exampleBoost = Math.max(0, connectsTarget - exampleBase)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Bidding & Connects</h2>

      {saved && <div className="text-sm text-green-600 font-semibold">✅ Saved!</div>}

      <section className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={normalizerEnabled}
            onChange={(e) => setNormalizerEnabled(e.target.checked)} />
          <span className="text-gray-700 font-medium">Enable Connects Normalizer</span>
        </label>
        <p className="text-xs text-gray-500">
          Automatically sets the boost bid so your total connects spend equals the target.
          Silently skips if Upwork's UI changes. Never blocks proposal submission.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Total Connects: <span className="font-bold text-green-700">{connectsTarget}</span>
          </label>
          <input type="range" min={1} max={40} value={connectsTarget}
            onChange={(e) => setConnectsTarget(parseInt(e.target.value))}
            className="w-full accent-green-600" />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>1</span><span>10</span><span>20</span><span>30</span><span>40</span>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Example:</p>
          <p className="text-gray-600">
            If base cost is <strong>{exampleBase} connects</strong> and target is <strong>{connectsTarget}</strong>:
          </p>
          <p className="text-gray-600">
            Boost will be set to <strong>{exampleBoost} connects</strong>
            {exampleBoost === 0 ? ' (no boost needed — base already at/above target)' : ''}
          </p>
        </div>
      </section>

      <button onClick={save}
        className="px-6 py-2 bg-upwork-green text-white font-semibold rounded-lg hover:opacity-90">
        {saved ? '✅ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
