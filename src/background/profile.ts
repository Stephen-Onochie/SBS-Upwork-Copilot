import type { Profile, ProfileVersion } from '@/lib/types'
import { get, set } from '@/lib/storage'
import { callScoringModel } from './gemini'
import { logEvent } from './supabase'

export async function analyzeProfile(rawText: string): Promise<Profile> {
  // Trim aggressively — 5k chars is plenty for structured extraction
  const trimmedText = rawText.slice(0, 5000)

  const prompt = `Extract Upwork profile data from the text below. Return ONLY valid JSON, no markdown, no explanation.

JSON shape:
{"title":"","headline":"","overview":"","rate":"","skills":[],"workHistory":[{"title":"","description":"","skills":[],"startDate":"","endDate":""}],"employment":[{"company":"","title":"","startDate":"","endDate":""}],"education":[{"school":"","degree":"","field":""}]}

Profile text:
${trimmedText}`

  const responseText = await callScoringModel(prompt, { temperature: 0.1, maxOutputTokens: 2048 })

  let profile: Profile
  try {
    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    profile = JSON.parse(cleaned) as Profile
  } catch {
    throw new Error('Failed to parse profile JSON from Gemini response')
  }

  // Save profile + version history
  const { profile_versions } = await get(['profile_versions'])
  const versions: ProfileVersion[] = profile_versions ?? []
  versions.push({ timestamp: new Date().toISOString(), profile })
  // Keep last 5 versions only
  const trimmedVersions = versions.slice(-5)

  await set({
    profile,
    profile_versions: trimmedVersions,
    last_profile_analysis: new Date().toISOString(),
  })

  // Log to Supabase
  const { projects } = await get(['projects'])
  await logEvent('profile_analyses', {
    num_projects: (projects ?? []).length,
    num_skills: (profile.skills ?? []).length,
  }).catch(console.warn)

  return profile
}
