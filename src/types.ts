import type { FeatureCollection } from 'geojson'

export type Severity = 'none' | 'mild' | 'moderate' | 'severe' | 'critical'

export type RoadStatus = 'open' | 'blocked' | 'uncertain'

export type VerificationStatus = 'pending' | 'confirmed' | 'corrected' | 'rejected' | 'uncertain'

export type SourceType = 'satellite' | 'drone' | 'street'

export type FactorKey = 'damage' | 'population' | 'vulnerability' | 'access' | 'service' | 'confidence'

export interface FactorWeights {
  damage: number
  population: number
  vulnerability: number
  access: number
  service: number
  confidence: number
}

export interface Evidence {
  id: string
  kind: 'imagery' | 'detection' | 'context' | 'access' | 'audit'
  label: string
  caption: string
  image?: string
  sourceType?: SourceType
  confidence?: number
  model?: string
}

export interface PriorityLocation {
  id: string
  scenarioId: string
  rank: number
  name: string
  sub: string
  type: 'settlement' | 'facility' | 'junction' | 'field'
  lat: number
  lng: number
  score: number
  factors: Record<FactorKey, number>
  damageLevel: Severity
  roadStatus: RoadStatus
  affectedPopulation: number
  buildingsAffected: number
  nearbyFacilities: string[]
  nearestFacility: string
  serviceRisk: Severity
  detections: number
  status: VerificationStatus
  aiConfidence: number
  evidence: Evidence[]
  note: string
  isFieldReport?: boolean
  reporter?: string
  submittedAt?: string
}

export interface DisasterEvent {
  id: string
  name: string
  type: 'cyclone' | 'flood' | 'fire' | 'earthquake'
  region: string
  status: 'processing' | 'ready' | 'review'
  startedAt: string
  imageryCount: number
  aiProgress: number
}

export interface KpiSummary {
  buildingsAffected: number
  buildingsVerified: number
  roadsBlocked: number
  roadsChecked: number
  servicesAtRisk: number
  populationAffected: number
  avgConfidence: number
  verifiedShare: number
}

export interface AuditEntry {
  id: string
  time: string
  actor: string
  action: string
  target: string
}

export interface Toast {
  id: number
  tone: 'success' | 'info' | 'warn' | 'neutral'
  title: string
  detail?: string
}

export type FilterKey = 'damage' | 'roads' | 'services'

/** Extra data layers that can be toggled on the map. */
export type DataLayerKey = 'population' | 'buildings'

export interface RouteInfo {
  facility: string
  geojson: FeatureCollection
  distanceM: number
  durationS: number
  alternatives: number
  facilityLngLat: [number, number]
}
