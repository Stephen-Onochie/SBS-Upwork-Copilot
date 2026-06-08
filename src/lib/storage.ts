import type { StorageSchema, ScoringWeights, ScoringGates, NotificationConfig } from './types'

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  fitToProfile: 30,
  clientTrust: 25,
  hireRate: 12,
  budgetStrength: 13,
  competition: 12,
  freshness: 8,
}

export const DEFAULT_SCORING_GATES: ScoringGates = {
  fixedFloor: 300,
  hourlyFloor: 30,
  requirePaymentVerified: false,
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  threshold: 7,
  sound: 'default',
  volume: 70,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  batchingEnabled: true,
}

export function get<K extends keyof StorageSchema>(keys: K[]): Promise<Pick<StorageSchema, K>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys as string[], (result) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve(result as Pick<StorageSchema, K>)
    })
  })
}

export function set(items: Partial<StorageSchema>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

export function remove(keys: (keyof StorageSchema)[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys as string[], () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
      else resolve()
    })
  })
}

// Convenience getters with defaults

export async function getScoringWeights(): Promise<ScoringWeights> {
  const { scoring_weights } = await get(['scoring_weights'])
  return scoring_weights ?? DEFAULT_SCORING_WEIGHTS
}

export async function getScoringGates(): Promise<ScoringGates> {
  const { scoring_gates } = await get(['scoring_gates'])
  return scoring_gates ?? DEFAULT_SCORING_GATES
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  const { notification_config } = await get(['notification_config'])
  return notification_config ?? DEFAULT_NOTIFICATION_CONFIG
}

export async function getGeminiKey(): Promise<string | undefined> {
  const { gemini_api_key } = await get(['gemini_api_key'])
  return gemini_api_key
}

export async function getGeminiModels(): Promise<{ generation: string; scoring: string; rpmCap: number }> {
  const { gemini_model_generation, gemini_model_scoring, gemini_rpm_cap } = await get([
    'gemini_model_generation',
    'gemini_model_scoring',
    'gemini_rpm_cap',
  ])
  return {
    generation: gemini_model_generation ?? 'gemini-2.0-flash',
    scoring: gemini_model_scoring ?? 'gemini-2.0-flash-lite',
    rpmCap: gemini_rpm_cap ?? 10,
  }
}

export async function getOpenRouterKey(): Promise<string | undefined> {
  const { openrouter_api_key } = await get(['openrouter_api_key'])
  return openrouter_api_key
}

export async function getOpenRouterModels(): Promise<{ generation: string; scoring: string }> {
  const { openrouter_model_generation, openrouter_model_scoring } = await get([
    'openrouter_model_generation',
    'openrouter_model_scoring',
  ])
  return {
    generation: openrouter_model_generation ?? 'google/gemini-flash-1.5',
    scoring: openrouter_model_scoring ?? 'google/gemini-flash-1.5',
  }
}

export async function getActiveProvider(): Promise<'gemini' | 'openrouter'> {
  const { active_provider } = await get(['active_provider'])
  return active_provider ?? 'gemini'
}

export async function getConnectsTarget(): Promise<number> {
  const { connects_target } = await get(['connects_target'])
  return connects_target ?? 20
}

export async function isMonitorSnoozed(): Promise<boolean> {
  const { monitor_snoozed_until } = await get(['monitor_snoozed_until'])
  if (!monitor_snoozed_until) return false
  return Date.now() < monitor_snoozed_until
}

// Dedupe cache helpers (rolling cap of 2000)
const DEDUPE_CAP = 2000

export async function hasSeenJob(jobId: string): Promise<boolean> {
  const { seen_job_ids } = await get(['seen_job_ids'])
  return (seen_job_ids ?? []).includes(jobId)
}

export async function markJobSeen(jobId: string): Promise<void> {
  const { seen_job_ids } = await get(['seen_job_ids'])
  const cache = seen_job_ids ?? []
  cache.push(jobId)
  const trimmed = cache.length > DEDUPE_CAP ? cache.slice(cache.length - DEDUPE_CAP) : cache
  await set({ seen_job_ids: trimmed })
}
