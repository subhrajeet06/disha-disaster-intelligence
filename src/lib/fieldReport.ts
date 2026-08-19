import type { Evidence, FactorKey, PriorityLocation, RoadStatus, Severity } from '../types'

export interface FieldReportInput {
  name: string
  lat: number
  lng: number
  damageLevel: Severity
  roadStatus: RoadStatus
  serviceRisk: Severity
  populationExposure: number
  criticalFacilityNearby: boolean
  vulnerableGroupsNearby: boolean
  affectedBuildings: number
  photo: string
  photoName: string
  description: string
  reporter: string
}

export function severityToScore(s: Severity): number {
  switch (s) {
    case 'critical':
      return 100
    case 'severe':
      return 82
    case 'moderate':
      return 58
    case 'mild':
      return 30
    default:
      return 5
  }
}

export function roadToScore(r: RoadStatus): number {
  switch (r) {
    case 'blocked':
      return 100
    case 'uncertain':
      return 60
    default:
      return 8
  }
}

export function computeScore(
  damage: number,
  population: number,
  vulnerability: number,
  access: number,
  service: number,
  confidence: number,
): number {
  const weighted =
    damage * 0.3 +
    population * 0.2 +
    vulnerability * 0.2 +
    access * 0.15 +
    service * 0.1 +
    confidence * 0.05
  return Math.round(weighted)
}

export function buildFieldReport(input: FieldReportInput, now: string): Omit<PriorityLocation, 'scenarioId'> {
  const damage = severityToScore(input.damageLevel)
  const access = roadToScore(input.roadStatus)
  const service = severityToScore(input.serviceRisk)
  const vulnerability = Math.min(
    100,
    25 + (input.criticalFacilityNearby ? 40 : 0) + (input.vulnerableGroupsNearby ? 25 : 0),
  )
  const population = input.populationExposure
  const confidence = 93

  const score = computeScore(damage, population, vulnerability, access, service, confidence)
  const factors = { damage, population, vulnerability, access, service, confidence } as Record<FactorKey, number>

  const evidence: Evidence[] = [
    {
      id: `fr-ev-${Date.now()}`,
      kind: 'imagery',
      label: input.photoName || 'Field photo',
      caption: 'Human-submitted ground report, awaiting AI cross-check.',
      image: input.photo,
      sourceType: 'street',
      confidence: 0.93,
    },
    {
      id: `fr-ev-${Date.now()}b`,
      kind: 'audit',
      label: 'Submitted by field operator',
      caption: `Reported ${now} · ${input.reporter || 'anonymous'}. Photo and GPS embedded as immutable evidence.`,
    },
  ]

  const roadLabel =
    input.roadStatus === 'blocked' ? 'Road blocked' : input.roadStatus === 'uncertain' ? 'Road uncertain' : 'Road open'

  return {
    id: `field-${Date.now()}`,
    rank: 0,
    name: input.name.trim() || 'Field report',
    sub: 'Field report · human-verified',
    type: 'field',
    lat: input.lat,
    lng: input.lng,
    score,
    factors,
    damageLevel: input.damageLevel,
    roadStatus: input.roadStatus,
    affectedPopulation: population,
    buildingsAffected: input.affectedBuildings,
    nearbyFacilities: input.criticalFacilityNearby ? ['Critical facility reported nearby'] : [],
    nearestFacility: input.criticalFacilityNearby ? 'Reported nearby' : '—',
    serviceRisk: input.serviceRisk,
    detections: 1,
    status: 'confirmed',
    aiConfidence: 0.93,
    evidence,
    note:
      input.description.trim() ||
      `Ground report: ${input.damageLevel} damage · ${roadLabel} · ${input.serviceRisk} service risk.`,
    isFieldReport: true,
    reporter: input.reporter.trim() || 'Field operator',
    submittedAt: now,
  }
}

export function factorWeight(key: string): number {
  const m: Record<string, number> = { damage: 0.3, population: 0.2, vulnerability: 0.2, access: 0.15, service: 0.1, confidence: 0.05 }
  return m[key] ?? 0
}
