import React, { useEffect, useState } from 'react'

type Status = 'idle' | 'testing' | 'ok' | 'error'

function EyeIcon({ open }: { open: boolean }): React.ReactElement {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

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

  const [openRouterKey, setOpenRouterKey] = useState('')
  const [openRouterGenModel, setOpenRouterGenModel] = useState('')
  const [openRouterScoringModel, setOpenRouterScoringModel] = useState('')
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openrouter'>('gemini')

  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)
  const [showHubspotToken, setShowHubspotToken] = useState(false)
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [geminiStatus, setGeminiStatus] = useState<Status>('idle')
  const [geminiError, setGeminiError] = useState('')
  const [orTestStatus, setOrTestStatus] = useState<Status>('idle')
  const [orError, setOrError] = useState('')
  const [hubspotStatus, setHubspotStatus] = useState<Status>('idle')
  const [hubspotError, setHubspotError] = useState('')
  const [supabaseStatus, setSupabaseStatus] = useState<Status>('idle')
  const [supabaseError, setSupabaseError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(
      ['gemini_api_key', 'hubspot_token', 'supabase_url', 'supabase_anon_key', 'supabase_email',
       'gemini_model_generation', 'gemini_model_scoring', 'gemini_rpm_cap',
       'openrouter_api_key', 'openrouter_model_generation', 'openrouter_model_scoring', 'active_provider'],
      (result) => {
        if (result.gemini_api_key) setGeminiKey(result.gemini_api_key as string)
        if (result.hubspot_token) setHubspotToken(result.hubspot_token as string)
        if (result.supabase_url) setSupabaseUrl(result.supabase_url as string)
        if (result.supabase_anon_key) setSupabaseAnonKey(result.supabase_anon_key as string)
        if (result.supabase_email) setSupabaseEmail(result.supabase_email as string)
        if (result.gemini_model_generation) setGeminiModel(result.gemini_model_generation as string)
        if (result.gemini_model_scoring) setScoringModel(result.gemini_model_scoring as string)
        if (result.gemini_rpm_cap) setRpmCap(result.gemini_rpm_cap as number)
        if (result.openrouter_api_key) setOpenRouterKey(result.openrouter_api_key as string)
        if (result.openrouter_model_generation) setOpenRouterGenModel(result.openrouter_model_generation as string)
        if (result.openrouter_model_scoring) setOpenRouterScoringModel(result.openrouter_model_scoring as string)
        if (result.active_provider) setActiveProvider(result.active_provider as 'gemini' | 'openrouter')
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
      openrouter_api_key: openRouterKey,
      openrouter_model_generation: openRouterGenModel,
      openrouter_model_scoring: openRouterScoringModel,
      active_provider: activeProvider,
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

  async function testOpenRouter(): Promise<void> {
    setOrTestStatus('testing')
    setOrError('')
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'TEST_OPENROUTER_KEY', apiKey: openRouterKey })
      setOrTestStatus(resp.ok ? 'ok' : 'error')
      if (!resp.ok) setOrError(resp.error ?? 'Unknown error')
    } catch (err) {
      setOrTestStatus('error')
      setOrError(err instanceof Error ? err.message : 'Unknown error')
    }
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
      supabaseUrl,
      supabaseAnonKey,
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

      {/* Provider */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">Active AI Provider</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Active AI Provider</label>
          <select
            value={activeProvider}
            onChange={(e) => setActiveProvider(e.target.value as 'gemini' | 'openrouter')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>
        <p className="text-xs text-gray-400">
          OpenRouter lets you use any model (GPT-4o, Claude, Llama, etc.) with your own credits. Gemini is the free default.
        </p>
      </section>

      {/* Gemini */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">Google Gemini</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">API Key</label>
          <div className="relative">
            <input
              type={showGeminiKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm"
            />
            <button type="button" onClick={() => setShowGeminiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <EyeIcon open={showGeminiKey} />
            </button>
          </div>
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

      {/* OpenRouter */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">OpenRouter</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">API Key</label>
          <div className="relative">
            <input
              type={showOpenRouterKey ? 'text' : 'password'}
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm"
            />
            <button type="button" onClick={() => setShowOpenRouterKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <EyeIcon open={showOpenRouterKey} />
            </button>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Generation Model</label>
            <input value={openRouterGenModel} onChange={(e) => setOpenRouterGenModel(e.target.value)}
              placeholder="google/gemini-flash-1.5"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-48" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Scoring Model</label>
            <input value={openRouterScoringModel} onChange={(e) => setOpenRouterScoringModel(e.target.value)}
              placeholder="google/gemini-flash-1.5"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-48" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void testOpenRouter()} disabled={orTestStatus === 'testing'}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg disabled:opacity-50">
            Test Connection
          </button>
          <StatusBadge status={orTestStatus} errorMsg={orError} />
        </div>
        <p className="text-xs text-gray-400">
          Only the active provider (selected above) is used for AI calls.
        </p>
      </section>

      {/* HubSpot */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-800">HubSpot</h3>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Private App Access Token</label>
          <div className="relative">
            <input
              type={showHubspotToken ? 'text' : 'password'}
              value={hubspotToken}
              onChange={(e) => setHubspotToken(e.target.value)}
              placeholder="pat-na1-..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm"
            />
            <button type="button" onClick={() => setShowHubspotToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <EyeIcon open={showHubspotToken} />
            </button>
          </div>
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
            <div className="relative">
              <input type={showAnonKey ? 'text' : 'password'} value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm" />
              <button type="button" onClick={() => setShowAnonKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon open={showAnonKey} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input type="email" value={supabaseEmail} onChange={(e) => setSupabaseEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={supabasePassword} onChange={(e) => setSupabasePassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm" />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon open={showPassword} />
              </button>
            </div>
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
