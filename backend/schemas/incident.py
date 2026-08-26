from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class IncidentStatus(str, Enum):
    DRAFT = "DRAFT"
    IMAGERY_READY = "IMAGERY_READY"
    AI_ASSESSED = "AI_ASSESSED"
    UNDER_VERIFICATION = "UNDER_VERIFICATION"
    VERIFIED = "VERIFIED"
    PRIORITIZED = "PRIORITIZED"
    FIELD_ASSIGNED = "FIELD_ASSIGNED"
    RESOLVED = "RESOLVED"

class DisasterType(str, Enum):
    EARTHQUAKE = "earthquake"
    FLOOD = "flood"
    CYCLONE = "cyclone"
    LANDSLIDE = "landslide"
    WILDFIRE = "wildfire"
    TSUNAMI = "tsunami"
    OTHER = "other"

class GeographicInfo(BaseModel):
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    block: Optional[str] = None
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geometry: Optional[Dict[str, Any]] = None  # GeoJSON-compatible

class ImageryInfo(BaseModel):
    before_image: Optional[str] = None
    after_image: Optional[str] = None
    before_image_name: Optional[str] = None
    after_image_name: Optional[str] = None
    source: Optional[str] = None
    acquisition_date: Optional[datetime] = None

class SpatialOutputInfo(BaseModel):
    analysis_id: str
    artifacts: Dict[str, str] = Field(default_factory=dict)
    
class AIAssessment(BaseModel):
    status: str = "NOT_RUN"
    model_version: Optional[str] = None
    damage_regions: int = 0
    severe_regions: int = 0
    damage_area_percent: float = 0.0
    inference_timestamp: Optional[datetime] = None
    spatial_output: Optional[SpatialOutputInfo] = None

class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CORRECTED = "CORRECTED"
    REJECTED = "REJECTED"

class VerificationInfo(BaseModel):
    status: str = VerificationStatus.PENDING
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    correction_notes: Optional[str] = None

class VerificationRequest(BaseModel):
    decision: VerificationStatus
    notes: Optional[str] = None
    reviewer_name: str

class PriorityInfo(BaseModel):
    level: Optional[str] = None  # e.g., LOW, MEDIUM, HIGH, CRITICAL
    score: Optional[float] = None
    reason: Optional[str] = None

class FieldResponseInfo(BaseModel):
    assigned: bool = False
    assigned_team: Optional[str] = None
    assigned_at: Optional[datetime] = None
    response_status: str = "NOT_ASSIGNED"

class IncidentCreate(BaseModel):
    name: str = Field(..., description="Name of the incident/scenario")
    disaster_type: DisasterType
    description: Optional[str] = None
    area: Optional[GeographicInfo] = None
    imagery: Optional[ImageryInfo] = None

class IncidentUpdate(BaseModel):
    name: Optional[str] = None
    disaster_type: Optional[DisasterType] = None
    description: Optional[str] = None
    area: Optional[GeographicInfo] = None
    imagery: Optional[ImageryInfo] = None

class Incident(BaseModel):
    id: str
    name: str
    disaster_type: DisasterType
    description: Optional[str] = None
    status: IncidentStatus = IncidentStatus.DRAFT
    created_at: datetime
    updated_at: datetime
    
    area: GeographicInfo = Field(default_factory=GeographicInfo)
    imagery: ImageryInfo = Field(default_factory=ImageryInfo)
    ai_assessment: AIAssessment = Field(default_factory=AIAssessment)
    verification: VerificationInfo = Field(default_factory=VerificationInfo)
    priority: PriorityInfo = Field(default_factory=PriorityInfo)
    field_response: FieldResponseInfo = Field(default_factory=FieldResponseInfo)

class IncidentResponse(Incident):
    pass
