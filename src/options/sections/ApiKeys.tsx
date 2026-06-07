import React, { useEffect, useState } from 'react'

type Status = 'idle' | 'testing' | 'ok' | 'error'

export function ApiKeys(): React.ReactElement {
  const [geminiKey, setGeminiKey] = useState('')
  const [hubspotToken, setHubspotToken] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [supabaseEmail, setSupabaseEmail] = useState('')
  const [supabasePassword, setSupabasePassword] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash')
  const [scoringModel, setScoringModel] = useState('gemini-2.0-flash-lite')
  const [rpmCap, setRpmCap] = useState(10)

  const [geminiStatus, setGeminiStatus] = useState<Status>('idle')
  const [geminiError, setGeminiError] = useState('')
  const [hubspotStatus, setHubspotStatus] = useState<Status>('idle')
  const [hubspotError, setHubspotError] = useState('')
  const [supabaseStatus, setSupabaseStatus] = useState<Status>('idle')
  const [supabaseError, setSupabaseError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(
      ['gemini_api_key', 'hubspot_token', 'supabase_url', 'supabase_anon_key', 'supabase_email',
       'gemini_model_generation', 'gemini_model_scoring', 'gemini_rpm_cap'],
      (result) => {
        if (result.gemini_api_key) setGeminiKey(result.gemini_api_key as string)
        if (result.hubspot_token) setHubspotToken(result.hubspot_token as string)
        if (result.supabase_url) setSupabaseUrl(result.supabase_url as string)
        if (result.supabase_anon_key) setSupabaseAnonKey(result.supabase_anon_key as string)
        if (result.supabase_email) setSupabaseEmail(result.supabase_email as string)
        if (result.gemini_model_generation) setGeminiModel(result.gemini_model_generation as string)
        if (result.gemini_model_scoring) setScoringModel(result.gemini_model_scoring as string)
        if (result.gemini_rpm_cap) setRpmCap(result.gemini_rpm_cap as number)
      }
    )
  }, [])

  function save(): void {
    chrome.storage.local.set({
      gemini_api_key: geminiKey,
      hubspot_token: hubspotToken,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      supabase_email: supabaseEmail,
      gemini_model_generation: geminiModel,
      gemini_model_scoring: scoringModel,
      gemini_rpm_cap: rpmCap,
    }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function testGemini(): Promise<void> {
    setGeminiStatus('testing')
    setGeminiError('')
    const resp = await chrome.runtime.sendMessage({ type: 'TEST_GEMINI_KEY', apiKey: geminiKey })
    setGeminiStatus(resp.ok ? 'ok' : 'error')
    if (!resp.ok) setGeminiError(resp.error ?? 'Unknown error')
  }

  async function testHubSpot(): Promise<void> {
    setHubspotStatus('testing')
    setHubspotError('')
    const resp = await chrome.runtime.sendMessage({ type: 'TEST_HUBSPOT_TOKEN', token: hubspotToken })
    setHubspotStatus(resp.ok ? 'ok' : 'error')
    if (!resp.ok) setHubspotError(resp.error ?? 'Unknown error')
  }

  async function loginSupabase(): Promise<void> {
    if (!supabaseEmail || !supabasePassword) return
    setSupabaseStatus('testing')
    setSupabaseError('')
    const resp = await chrome.runtime.sendMessage({
      type: 'SUPABASE_LOGIN',
      email: supabaseEmail,
      password: supabasePassword,
    })
    setSupabaseStatus(resp.ok ? 'ok' : 'error')
    if (!resp.ok) setSupabaseError(resp.error ?? 'Unknown error')
  }

  const StatusBadge = ({ status, errorMsg }: { status: Status; errorMsg?: string }): React.ReactElement => {
    if (status === 'idle') return <></>
    if (status === 'testing') return <span className="text-xs text-gray-500">Testing...</span>
    if (status === 'ok') return <span className="text-xs text-green-600 font-semibold">✅ Connected</span>
    return (
      <span className="text-xs text-red-600 font-semibold">
        ❌ Failed{errorMsg ? ` — ${errorMsg}` : ''}
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-sbs-navy font-display">API Keys & Configuration</h2>

      {/* Gemini */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">Google Gemini</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">API Key</label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Generation Model</label>
            <input value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-48" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scoring Model</label>
            <input value={scoringModel} onChange={(e) => setScoringModel(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-48" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RPM Cap</label>
            <input type="number" min={1} max={60} value={rpmCap} onChange={(e) => setRpmCap(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-16" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void testGemini()}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
            Test Connection
          </button>
          <StatusBadge status={geminiStatus} errorMsg={geminiError} />
        </div>
        <p className="text-xs text-gray-400">
          ⚠️ Free tier may use prompts for model training. Keep sensitive data minimal in prompts.
        </p>
      </section>

      {/* HubSpot */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">HubSpot</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Private App Access Token</label>
          <input
            type="password"
            value={hubspotToken}
            onChange={(e) => setHubspotToken(e.target.value)}
            placeholder="pat-na1-..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void testHubSpot()}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
            Test Connection
          </button>
          <StatusBadge status={hubspotStatus} errorMsg={hubspotError} />
        </div>
      </section>

      {/* Supabase */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">Supabase (Event Logging)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Project URL</label>
            <input value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxx.supabase.co"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Anon Key</label>
            <input type="password" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input type="email" value={supabaseEmail} onChange={(e) => setSupabaseEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input type="password" value={supabasePassword} onChange={(e) => setSupabasePassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void loginSupabase()}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
            Sign In
          </button>
          <StatusBadge status={supabaseStatus} errorMsg={supabaseError} />
        </div>
      </section>

      <button onClick={save}
        className="px-6 py-2 bg-sbs-gold text-sbs-navy font-semibold rounded-lg hover:bg-sbs-gold-light transition-colors">
        {saved ? '✅ Saved!' : 'Save All'}
      </button>
    </div>
  )
}
