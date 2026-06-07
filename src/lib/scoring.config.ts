import type { ScoringWeights, ScoringGates } from './types'

export const DEFAULT_WEIGHTS: ScoringWeights = {
  fitToProfile: 30,
  clientTrust: 25,
  hireRate: 12,
  budgetStrength: 13,
  competition: 12,
  freshness: 8,
}

export const DEFAULT_GATES: ScoringGates = {
  fixedFloor: 300,
  hourlyFloor: 30,
  requirePaymentVerified: false,
}

// Maps internal 0–100 score to 1–10 integer
export function mapScore(internal: number): number {
  return Math.max(1, Math.min(10, Math.round(internal / 10)))
}
