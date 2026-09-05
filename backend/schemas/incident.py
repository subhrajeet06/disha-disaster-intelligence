from enum import Enum
from typing import Optional, Dict, Any, List
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

class PriorityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class PriorityFactor(BaseModel):
    name: str
    value: str
    contribution: int

class PriorityInfo(BaseModel):
    status: str = "PENDING"  # PENDING, CALCULATED, STALE
    risk_score: Optional[int] = None
    level: Optional[PriorityLevel] = None
    factors: List[PriorityFactor] = Field(default_factory=list)
    calculated_at: Optional[datetime] = None
    scoring_version: Optional[str] = "F1"

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

class ResourceType(str, Enum):
    MEDICAL_TEAM = "MEDICAL_TEAM"
    SEARCH_AND_RESCUE = "SEARCH_AND_RESCUE"
    FIRE_RESPONSE = "FIRE_RESPONSE"
    EVACUATION_SUPPORT = "EVACUATION_SUPPORT"
    SHELTER = "SHELTER"
    FOOD_WATER = "FOOD_WATER"
    ROAD_CLEARANCE = "ROAD_CLEARANCE"

class Resource(BaseModel):
    id: str
    name: str
    type: ResourceType
    quantity_total: int
    quantity_available: int
    status: str = "AVAILABLE"
    location: str

class ResponseRequirement(BaseModel):
    type: ResourceType
    recommended_quantity: int
    reason: str
    priority: PriorityLevel

class ResourceMatch(BaseModel):
    type: ResourceType
    required: int
    available: int
    recommended: int

class UnmetRequirement(BaseModel):
    type: ResourceType
    unmet_quantity: int

class CoordinationStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class CoordinationItem(BaseModel):
    resource_type: ResourceType
    required_quantity: int
    completed_quantity: int = 0

class CoordinationInfo(BaseModel):
    status: CoordinationStatus = CoordinationStatus.NOT_STARTED
    items: List[CoordinationItem] = Field(default_factory=list)
    overall_progress: float = 0.0
    started_at: Optional[datetime] = None
    started_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None

class ResponsePlanStatus(str, Enum):
    NOT_GENERATED = "NOT_GENERATED"
    DRAFT = "DRAFT"
    READY_FOR_APPROVAL = "READY_FOR_APPROVAL"
    APPROVED = "APPROVED"
    STALE = "STALE"
    REJECTED = "REJECTED"

class ResponsePlanInfo(BaseModel):
    status: ResponsePlanStatus = ResponsePlanStatus.NOT_GENERATED
    requirements: List[ResponseRequirement] = Field(default_factory=list)
    resource_matches: List[ResourceMatch] = Field(default_factory=list)
    unmet_requirements: List[UnmetRequirement] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    coordination: CoordinationInfo = Field(default_factory=CoordinationInfo)

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
    response_plan: ResponsePlanInfo = Field(default_factory=ResponsePlanInfo)

class IncidentResponse(Incident):
    pass

class ApprovePlanRequest(BaseModel):
    approver_name: str

class CoordinationStartRequest(BaseModel):
    started_by: str

class CoordinationProgressUpdate(BaseModel):
    resource_type: ResourceType
    completed_quantity: int

class CoordinationCompleteRequest(BaseModel):
    completed_by: str
