import { getGeminiKey, getGeminiModels, getOpenRouterKey, getOpenRouterModels, getActiveProvider } from '@/lib/storage'

interface GeminiCallOptions {
  apiKey?: string
  temperature?: number
  maxOutputTokens?: number
}

interface QueueEntry {
  model: string
  prompt: string
  options: GeminiCallOptions
  resolve: (value: string) => void
  reject: (reason: Error) => void
}

// ─── Request Queue ────────────────────────────────────────────────────────────

const queue: QueueEntry[] = []
let processing = false
let lastCallTime = 0

// ─── OpenRouter Queue ─────────────────────────────────────────────────────────

const orQueue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void; model: string; prompt: string; options: GeminiCallOptions }> = []
let orProcessing = false
let orLastCallTime = 0

async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return
  processing = true

  while (queue.length > 0) {
    const entry = queue.shift()!
    const { rpmCap } = await getGeminiModels()
    const minIntervalMs = Math.ceil(60_000 / rpmCap)
    const elapsed = Date.now() - lastCallTime
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed)
    }

    try {
      const result = await callGeminiDirect(entry.model, entry.prompt, entry.options)
      lastCallTime = Date.now()
      entry.resolve(result)
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  processing = false
}

export function callGemini(model: string, prompt: string, options: GeminiCallOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ model, prompt, options, resolve, reject })
    processQueue()
  })
}

// ─── Direct HTTP Call (with retry on 429) ────────────────────────────────────

async function callGeminiDirect(
  model: string,
  prompt: string,
  options: GeminiCallOptions,
  attempt = 0
): Promise<string> {
  const apiKey = options.apiKey ?? (await getGeminiKey())
  if (!apiKey) throw new Error('Gemini API key not configured')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
    },
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (resp.status === 429) {
    const maxAttempts = 5
    if (attempt >= maxAttempts) throw new Error('Gemini rate limit exceeded after retries')
    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000)
    console.warn(`[Gemini] 429 rate limit — retry in ${backoffMs}ms (attempt ${attempt + 1})`)
    await sleep(backoffMs)
    return callGeminiDirect(model, prompt, options, attempt + 1)
  }

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Gemini error ${resp.status}: ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

// ─── OpenRouter Direct Call (with retry on 429) ───────────────────────────────

async function callOpenRouterDirect(
  model: string,
  prompt: string,
  options: GeminiCallOptions,
  attempt = 0
): Promise<string> {
  const apiKey = options.apiKey ?? (await getOpenRouterKey())
  if (!apiKey) throw new Error('OpenRouter API key not configured')

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens ?? 2048,
    }),
  })

  if (resp.status === 429) {
    const maxAttempts = 5
    if (attempt >= maxAttempts) throw new Error('OpenRouter rate limit exceeded after retries')
    const backoffMs = Math.min(2 ** attempt * 2000, 30_000)
    console.warn(`[OpenRouter] 429 rate limit — retry in ${backoffMs}ms (attempt ${attempt + 1})`)
    await sleep(backoffMs)
    return callOpenRouterDirect(model, prompt, options, attempt + 1)
  }

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`OpenRouter error ${resp.status}: ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenRouter returned empty response')
  return text
}

async function processOrQueue(): Promise<void> {
  if (orProcessing || orQueue.length === 0) return
  orProcessing = true

  while (orQueue.length > 0) {
    const entry = orQueue.shift()!
    const elapsed = Date.now() - orLastCallTime
    const minIntervalMs = 1000 // 60 req/min default for OpenRouter
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed)
    }

    try {
      const result = await callOpenRouterDirect(entry.model, entry.prompt, entry.options)
      orLastCallTime = Date.now()
      entry.resolve(result)
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  orProcessing = false
}

export function callOpenRouter(model: string, prompt: string, options: GeminiCallOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    orQueue.push({ model, prompt, options, resolve, reject })
    void processOrQueue()
  })
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function callGenerationModel(prompt: string, options?: GeminiCallOptions): Promise<string> {
  const provider = await getActiveProvider()
  if (provider === 'openrouter') {
    const { generation } = await getOpenRouterModels()
    return callOpenRouter(generation, prompt, options ?? {})
  }
  const { generation } = await getGeminiModels()
  return callGemini(generation, prompt, options)
}

export async function callScoringModel(prompt: string, options?: GeminiCallOptions): Promise<string> {
  const provider = await getActiveProvider()
  if (provider === 'openrouter') {
    const { scoring } = await getOpenRouterModels()
    return callOpenRouter(scoring, prompt, options ?? {})
  }
  const { scoring } = await getGeminiModels()
  return callGemini(scoring, prompt, options)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
