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

export interface AIAssessment {
  status: string
  model_version?: string | null
  damage_regions: number
  severe_regions: number
  damage_area_percent: number
  inference_timestamp?: string | null
}

export interface VerificationInfo {
  status: string
  verified: boolean
  verified_by?: string | null
  verified_at?: string | null
  correction_notes?: string | null
}

export interface PriorityInfo {
  level?: string | null
  score?: number | null
  reason?: string | null
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
  priority: PriorityInfo
  field_response: FieldResponseInfo
}
