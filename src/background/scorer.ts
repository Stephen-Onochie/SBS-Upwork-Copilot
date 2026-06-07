import type { JobPost, ScoreResult } from '@/lib/types'
import { getScoringWeights, getScoringGates, get } from '@/lib/storage'
import { callScoringModel } from './gemini'
import { mapScore } from '@/lib/scoring.config'

export async function scoreJob(jobPost: JobPost): Promise<ScoreResult> {
  const gates = await getScoringGates()

  // ── Hard gate 1: fixed-price too low ────────────────────────────────────────
  if (jobPost.budget.type === 'fixed' && jobPost.budget.fixed !== undefined) {
    if (jobPost.budget.fixed < gates.fixedFloor) {
      return { score: 1, oneLineReason: `Fixed budget $${jobPost.budget.fixed} below minimum $${gates.fixedFloor}`, factorBreakdown: {} }
    }
  }

  // ── Hard gate 2: hourly upper bound too low ──────────────────────────────────
  if (jobPost.budget.type === 'hourly' && jobPost.budget.hourlyMax !== undefined) {
    if (jobPost.budget.hourlyMax < gates.hourlyFloor) {
      return { score: 1, oneLineReason: `Hourly ceiling $${jobPost.budget.hourlyMax}/hr below minimum $${gates.hourlyFloor}/hr`, factorBreakdown: {} }
    }
  }

  // ── Payment verified gate ────────────────────────────────────────────────────
  const paymentPenalty = gates.requirePaymentVerified && !jobPost.client.paymentVerified ? -30 : 0

  const weights = await getScoringWeights()
  const { profile, projects } = await get(['profile', 'projects'])

  // Build structured context for Gemini — numeric signals included so model stays consistent
  const scoringContext = {
    job: {
      title: jobPost.title,
      description: jobPost.description.slice(0, 800),
      skills: jobPost.skills,
      budget: jobPost.budget,
      postedAt: jobPost.postedAt,
    },
    client: jobPost.client,
    freelancerProfile: {
      title: profile?.title,
      skills: profile?.skills?.slice(0, 20),
      overview: profile?.overview?.slice(0, 500),
    },
    relevantProjects: (projects ?? []).slice(0, 5).map((p) => ({ name: p.name, tags: p.relevanceTags })),
    weights,
  }

  const prompt = `You are scoring a freelance job for Stephen at SBS Digital.

Context:
${JSON.stringify(scoringContext, null, 2)}

Score each factor on a 0–100 scale based on these definitions:
- fitToProfile (weight ${weights.fitToProfile}): How well the job matches the freelancer's skills, experience, and projects
- clientTrust (weight ${weights.clientTrust}): Payment verified, total spent, rating, hire rate (<40% = lower trust)
- hireRate (weight ${weights.hireRate}): Client's hire rate percentage
- budgetStrength (weight ${weights.budgetStrength}): Is the budget strong relative to market rates?
- competition (weight ${weights.competition}): Fewer proposals = better. Many invites already sent = worse.
- freshness (weight ${weights.freshness}): How recently posted? Newer = better response rates.

Return ONLY this JSON (no markdown, no explanation):
{
  "fitToProfile": 0-100,
  "clientTrust": 0-100,
  "hireRate": 0-100,
  "budgetStrength": 0-100,
  "competition": 0-100,
  "freshness": 0-100,
  "oneLineReason": "one concise sentence explaining the overall score"
}`

  let factorBreakdown: Record<string, number> = {}
  let oneLineReason = ''

  try {
    const responseText = await callScoringModel(prompt, { temperature: 0.1, maxOutputTokens: 300 })
    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, number | string>

    oneLineReason = String(parsed.oneLineReason ?? '')
    factorBreakdown = {
      fitToProfile: Number(parsed.fitToProfile ?? 50),
      clientTrust: Number(parsed.clientTrust ?? 50),
      hireRate: Number(parsed.hireRate ?? 50),
      budgetStrength: Number(parsed.budgetStrength ?? 50),
      competition: Number(parsed.competition ?? 50),
      freshness: Number(parsed.freshness ?? 50),
    }
  } catch {
    // Fallback to neutral scores if Gemini parse fails
    factorBreakdown = {
      fitToProfile: 50,
      clientTrust: 50,
      hireRate: 50,
      budgetStrength: 50,
      competition: 50,
      freshness: 50,
    }
    oneLineReason = 'Score computed from available signals'
  }

  // Weighted sum
  const rawScore =
    (factorBreakdown.fitToProfile * weights.fitToProfile +
      factorBreakdown.clientTrust * weights.clientTrust +
      factorBreakdown.hireRate * weights.hireRate +
      factorBreakdown.budgetStrength * weights.budgetStrength +
      factorBreakdown.competition * weights.competition +
      factorBreakdown.freshness * weights.freshness) /
    100

  const adjustedScore = Math.max(0, Math.min(100, rawScore + paymentPenalty))
  const score = mapScore(adjustedScore)

  return { score, oneLineReason, factorBreakdown }
}
