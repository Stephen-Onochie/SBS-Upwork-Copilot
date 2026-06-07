import React, { useEffect, useState } from 'react'
import type { ScoringWeights, ScoringGates } from '@/lib/types'
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_SCORING_GATES } from '@/lib/storage'

export function Scoring(): React.ReactElement {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS)
  const [gates, setGates] = useState<ScoringGates>(DEFAULT_SCORING_GATES)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['scoring_weights', 'scoring_gates'], (result) => {
      if (result.scoring_weights) setWeights(result.scoring_weights as ScoringWeights)
      if (result.scoring_gates) setGates(result.scoring_gates as ScoringGates)
    })
  }, [])

  function save(): void {
    chrome.storage.local.set({ scoring_weights: weights, scoring_gates: gates }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function resetDefaults(): void {
    setWeights(DEFAULT_SCORING_WEIGHTS)
    setGates(DEFAULT_SCORING_GATES)
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)

  const FACTORS: Array<{ key: keyof ScoringWeights; label: string; description: string }> = [
    { key: 'fitToProfile', label: 'Fit to Profile', description: 'How well job matches your skills & projects' },
    { key: 'clientTrust', label: 'Client Trust', description: 'Payment verified, spend history, rating' },
    { key: 'hireRate', label: 'Hire Rate', description: "Client's hiring percentage" },
    { key: 'budgetStrength', label: 'Budget Strength', description: 'Budget relative to market rates' },
    { key: 'competition', label: 'Competition', description: 'Fewer proposals = better opportunity' },
    { key: 'freshness', label: 'Freshness', description: 'Newer posts get better response rates' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Scoring Configuration</h2>
        <button onClick={resetDefaults}
          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Reset to Defaults
        </button>
      </div>

      {saved && <div className="text-sm text-green-600 font-semibold">✅ Saved!</div>}

      {/* Hard gates */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Hard Gates (auto-score 1 if triggered)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fixed Price Minimum ($)</label>
            <input type="number" value={gates.fixedFloor}
              onChange={(e) => setGates({ ...gates, fixedFloor: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Fixed-price jobs below this get score 1</p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hourly Rate Minimum ($/hr)</label>
            <input type="number" value={gates.hourlyFloor}
              onChange={(e) => setGates({ ...gates, hourlyFloor: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Hourly jobs where ceiling &lt; this get score 1</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={gates.requirePaymentVerified}
            onChange={(e) => setGates({ ...gates, requirePaymentVerified: e.target.checked })}
            className="rounded" />
          <span className="text-gray-700">Heavily penalize unverified payment clients</span>
        </label>
      </section>

      {/* Factor weights */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Factor Weights</h3>
          <span className={`text-xs font-semibold ${totalWeight === 100 ? 'text-green-600' : 'text-red-500'}`}>
            Total: {totalWeight}/100 {totalWeight !== 100 && '⚠️'}
          </span>
        </div>
        <div className="space-y-3">
          {FACTORS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-36 flex-shrink-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">{description}</p>
              </div>
              <input type="range" min={0} max={50} value={weights[key]}
                onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })}
                className="flex-1 accent-green-600" />
              <span className="w-8 text-right text-sm font-semibold text-gray-700">{weights[key]}</span>
            </div>
          ))}
        </div>
      </section>

      <button onClick={save}
        className="px-6 py-2 bg-upwork-green text-white font-semibold rounded-lg hover:opacity-90">
        {saved ? '✅ Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
