import type { FactorKey, PriorityLocation, RoadStatus, VerificationStatus } from '../types'

/** Weighted factors according to DISHA design specification */
export const WEIGHTS: Record<FactorKey, number> = {
  damage: 0.3,
  population: 0.2,
  vulnerability: 0.2,
  access: 0.15,
  service: 0.1,
  confidence: 0.05,
}

export interface FactorBreakdown {
  factor: FactorKey
  label: string
  rawScore: number
  weight: number
  weightedContribution: number
}

export interface ScoringExplanation {
  totalScore: number
  breakdown: FactorBreakdown[]
}

/**
  * Calculate priority score (0–100) using weighted factors.
  * Factors are expected to be 0–100 scale values.
  */
export function calculatePriorityScore(factors: Record<FactorKey, number>): number {
  let score = 0
  score += (factors.damage ?? 0) * WEIGHTS.damage
  score += (factors.population ?? 0) * WEIGHTS.population
  score += (factors.vulnerability ?? 0) * WEIGHTS.vulnerability
  score += (factors.access ?? 0) * WEIGHTS.access
  score += (factors.service ?? 0) * WEIGHTS.service
  score += (factors.confidence ?? 0) * WEIGHTS.confidence

  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
  * Explainable breakdown of factors, weights, and contributions.
  */
export function explainPriorityScore(factors: Record<FactorKey, number>): ScoringExplanation {
  const labels: Record<FactorKey, string> = {
    damage: 'Damage severity (30%)',
    population: 'Population exposure (20%)',
    vulnerability: 'Vulnerability (20%)',
    access: 'Accessibility risk (15%)',
    service: 'Critical service impact (10%)',
    confidence: 'AI confidence (5%)',
  }

  const breakdown: FactorBreakdown[] = (Object.keys(WEIGHTS) as FactorKey[]).map((key) => {
    const rawScore = factors[key] ?? 0
    const weight = WEIGHTS[key]
    const weightedContribution = Number((rawScore * weight).toFixed(2))
    return {
      factor: key,
      label: labels[key],
      rawScore,
      weight,
      weightedContribution,
    }
  })

  const totalScore = calculatePriorityScore(factors)
  return { totalScore, breakdown }
}

/**
  * Calculate service accessibility risk level, service factor (0-100), and explainable narrative.
  */
export function calculateServiceRiskExplanation(
  loc: PriorityLocation,
  roadStatusOverride?: RoadStatus,
): {
  riskLevel: 'Low' | 'Medium' | 'High'
  serviceFactor: number
  explanation: string
  nearbyDamageSummary: string
  affectedRoadSummary: string
  reachabilitySummary: string
} {
  const road = roadStatusOverride ?? loc.roadStatus
  const damage = loc.damageLevel

  let scorePoints = 0
  let nearbyDamageSummary = `Damage level classified as ${damage.toUpperCase()}.`
  let affectedRoadSummary = `Access corridor status: ${road.toUpperCase()}.`
  let reachabilitySummary = `Nearest critical facility (${loc.nearestFacility}) in reachable range.`

  if (damage === 'critical') scorePoints += 40
  else if (damage === 'severe') scorePoints += 30
  else if (damage === 'moderate') scorePoints += 15
  else scorePoints += 5

  if (road === 'blocked') {
    scorePoints += 45
    affectedRoadSummary = `Access corridor BLOCKED due to inundation/debris.`
    reachabilitySummary = `Direct vehicular access to ${loc.nearestFacility} severed; alternative/boat response likely required.`
  } else if (road === 'uncertain') {
    scorePoints += 25
    affectedRoadSummary = `Access corridor UNCERTAIN pending field verification.`
    reachabilitySummary = `Potential delay reaching ${loc.nearestFacility}; responder confirmation recommended.`
  } else {
    scorePoints += 5
    affectedRoadSummary = `Access corridor OPEN and passable.`
    reachabilitySummary = `Normal vehicular access to ${loc.nearestFacility} open.`
  }

  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
  let explanation = `Likely low service disruption based on open road access and mild physical impact.`

  if (scorePoints >= 60) {
    riskLevel = 'High'
    explanation = `Likely high accessibility risk and severe service disruption due to ${road === 'blocked' ? 'blocked access roads and ' : ''}${damage} structural damage near ${loc.nearestFacility}.`
  } else if (scorePoints >= 35) {
    riskLevel = 'Medium'
    explanation = `Likely moderate accessibility risk; access corridor is ${road} with ${damage} structural impact in the vicinity.`
  }

  // Scale service factor (0-100) for Priority Scoring
  const serviceFactor = Math.min(100, Math.max(10, scorePoints * 1.1))

  return {
    riskLevel,
    serviceFactor: Math.round(serviceFactor),
    explanation,
    nearbyDamageSummary,
    affectedRoadSummary,
    reachabilitySummary,
  }
}

/**
  * Calculate updated factor values and resulting priority score based on verification actions or road status changes.
  */
export function recalculateVerifiedLocation(
  baseLocation: PriorityLocation,
  verificationStatus: VerificationStatus,
  currentRoadStatus?: RoadStatus,
): { factors: Record<FactorKey, number>; score: number } {
  const factors = { ...baseLocation.factors }
  const road = currentRoadStatus ?? baseLocation.roadStatus

  // Adjust access factor dynamically based on road status
  if (road === 'blocked') {
    factors.access = 95
  } else if (road === 'uncertain') {
    factors.access = 65
  } else if (road === 'open') {
    factors.access = 10
  }

  // Dynamically update service risk factor based on service accessibility calculation
  const serviceEval = calculateServiceRiskExplanation(baseLocation, road)
  factors.service = serviceEval.serviceFactor

  // Adjust factors based on verification actions
  if (verificationStatus === 'confirmed') {
    // Verified by human responder: confidence goes to maximum
    factors.confidence = 100
  } else if (verificationStatus === 'rejected') {
    // Rejected by responder: damage and service impact demoted, confidence updated
    factors.damage = Math.round(factors.damage * 0.25)
    factors.service = Math.round(factors.service * 0.3)
    factors.confidence = 40
  } else if (verificationStatus === 'uncertain') {
    // Flagged for verification: confidence adjusted to reflect uncertainty
    factors.confidence = 50
  } else if (verificationStatus === 'corrected') {
    // Responder corrected details: human verified confidence
    factors.confidence = 95
  }

  const score = calculatePriorityScore(factors)
  return { factors, score }
}
