export type VerificationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'REJECTED'

export type IncidentStatus =
  | 'DRAFT'
  | 'IMAGERY_READY'
  | 'AI_ASSESSED'
  | 'UNDER_VERIFICATION'
  | 'VERIFIED'
  | 'PRIORITIZED'
  | 'FIELD_ASSIGNED'
  | 'RESOLVED'

export type DisasterType =
  | 'earthquake'
  | 'flood'
  | 'cyclone'
  | 'landslide'
  | 'wildfire'
  | 'tsunami'
  | 'other'

export interface GeographicInfo {
  district?: string | null
  state?: string | null
  country?: string | null
  block?: string | null
  village?: string | null
  latitude?: number | null
  longitude?: number | null
  geometry?: Record<string, any> | null // GeoJSON-compatible
}

export interface ImageryInfo {
  before_image?: string | null
  after_image?: string | null
  before_image_name?: string | null
  after_image_name?: string | null
  source?: string | null
  acquisition_date?: string | null
}

export interface SpatialOutputInfo {
  analysis_id: string
  artifacts: Record<string, string>
}

export interface AIAssessment {
  status: string
  model_version?: string | null
  damage_regions: number
  severe_regions: number
  damage_area_percent: number
  inference_timestamp?: string | null
  spatial_output?: SpatialOutputInfo | null
}

export interface VerificationInfo {
  status: VerificationStatus
  verified: boolean
  verified_by?: string | null
  verified_at?: string | null
  correction_notes?: string | null
}

export type PriorityLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export interface PriorityFactor {
  name: string
  value: string
  contribution: number
}

export interface PriorityInfo {
  status: string // 'PENDING' | 'CALCULATED' | 'STALE'
  risk_score?: number | null
  level?: PriorityLevel | null
  factors: PriorityFactor[]
  calculated_at?: string | null
  scoring_version?: string | null
}

export type ResourceType =
  | 'MEDICAL_TEAM'
  | 'SEARCH_AND_RESCUE'
  | 'FIRE_RESPONSE'
  | 'EVACUATION_SUPPORT'
  | 'SHELTER'
  | 'FOOD_WATER'
  | 'ROAD_CLEARANCE'

export interface ResponseRequirement {
  type: ResourceType
  recommended_quantity: number
  reason: string
  priority: PriorityLevel
}

export interface ResourceMatch {
  type: ResourceType
  required: number
  available: number
  recommended: number
}

export interface UnmetRequirement {
  type: ResourceType
  unmet_quantity: number
}

export type ResponsePlanStatus =
  | 'NOT_GENERATED'
  | 'DRAFT'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'STALE'
  | 'REJECTED'

export interface ResponsePlanInfo {
  status: ResponsePlanStatus
  requirements: ResponseRequirement[]
  resource_matches: ResourceMatch[]
  unmet_requirements: UnmetRequirement[]
  created_at?: string | null
  updated_at?: string | null
  approved_by?: string | null
  approved_at?: string | null
}

export interface FieldResponseInfo {
  assigned: boolean
  assigned_team?: string | null
  assigned_at?: string | null
  response_status: string
}

export interface Incident {
  id: string
  name: string
  disaster_type: DisasterType
  description?: string | null
  status: IncidentStatus
  created_at: string
  updated_at: string

  area: GeographicInfo
  imagery: ImageryInfo
  ai_assessment: AIAssessment
  verification: VerificationInfo
  priority?: PriorityInfo | null
  field_response?: FieldResponseInfo | null
  response_plan?: ResponsePlanInfo | null
}
