import type { Profile, ProfileVersion } from '@/lib/types'
import { get, set } from '@/lib/storage'
import { callGenerationModel } from './gemini'
import { logEvent } from './supabase'

export async function analyzeProfile(rawText: string): Promise<Profile> {
  const prompt = `You are helping a freelancer organize their Upwork profile data.

Structure the following raw Upwork profile text into a JSON object with these exact fields:
{
  "title": "string",
  "headline": "string",
  "overview": "string (full bio text)",
  "rate": "string (e.g. '$75/hr')",
  "skills": ["string"],
  "workHistory": [{ "title": "string", "description": "string", "skills": ["string"], "startDate": "string", "endDate": "string" }],
  "employment": [{ "company": "string", "title": "string", "startDate": "string", "endDate": "string" }],
  "education": [{ "school": "string", "degree": "string", "field": "string" }]
}

Return ONLY valid JSON, no markdown, no explanation.

Raw profile text:
${rawText}`

  const responseText = await callGenerationModel(prompt, { temperature: 0.1, maxOutputTokens: 4096 })

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
