import os
import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.incident import (
    Incident, 
    IncidentCreate, 
    IncidentUpdate, 
    IncidentStatus,
    SpatialOutputInfo,
    VerificationRequest,
    VerificationStatus,
    ResponsePlanStatus,
    ResponsePlanStatus,
    CoordinationStatus,
    CoordinationItem,
    CoordinationProgressUpdate,
    ResourceType
)
from backend.repositories.incident_repository import IncidentRepository
from backend import inference_service
from backend.services.priority_service import PriorityService
from backend.services.response_service import ResponseService

class IncidentService:
    def __init__(self, repository: IncidentRepository):
        self.repository = repository

    def create_incident(self, create_data: IncidentCreate) -> Incident:
        now = datetime.utcnow()
        incident_id = str(uuid.uuid4())
        
        # Build the Incident object
        incident = Incident(
            id=incident_id,
            name=create_data.name,
            disaster_type=create_data.disaster_type,
            description=create_data.description,
            status=IncidentStatus.DRAFT,
            created_at=now,
            updated_at=now
        )
        
        # Set optional nested structures if provided
        if create_data.area:
            incident.area = create_data.area
        if create_data.imagery:
            incident.imagery = create_data.imagery
            
        return self.repository.create(incident)

    def get_all_incidents(self) -> List[Incident]:
        return self.repository.get_all()

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self.repository.get_by_id(incident_id)

    def update_incident(self, incident_id: str, update_data: IncidentUpdate) -> Optional[Incident]:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            return None
            
        # Update allowed fields
        if update_data.name is not None:
            incident.name = update_data.name
        if update_data.disaster_type is not None:
            incident.disaster_type = update_data.disaster_type
        if update_data.description is not None:
            incident.description = update_data.description
        if update_data.area is not None:
            incident.area = update_data.area
        if update_data.imagery is not None:
            incident.imagery = update_data.imagery
            
        incident.updated_at = datetime.utcnow()
        return self.repository.update(incident)

    def delete_incident(self, incident_id: str) -> bool:
        return self.repository.delete(incident_id)

    def assess_incident(self, incident_id: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        if not incident.imagery or not incident.imagery.before_image or not incident.imagery.after_image:
            raise ValueError("Incident must have both before and after imagery to run assessment")
            
        # Safely resolve paths
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        
        pre_path = os.path.abspath(os.path.join(project_root, incident.imagery.before_image))
        post_path = os.path.abspath(os.path.join(project_root, incident.imagery.after_image))
        
        # Path traversal protection
        if not pre_path.startswith(project_root) or not post_path.startswith(project_root):
            raise ValueError("Invalid imagery path")
            
        if not os.path.exists(pre_path):
            raise ValueError("Before image not found on server")
        if not os.path.exists(post_path):
            raise ValueError("After image not found on server")
            
        try:
            result, out_dir = inference_service.run_analysis(pre_path, post_path)
            
            # Map result
            incident.ai_assessment.status = "AI_ASSESSED"
            incident.ai_assessment.model_version = "V11"
            
            stats = result.get("statistics", {})
            incident.ai_assessment.damage_regions = stats.get("damage_regions", 0)
            incident.ai_assessment.severe_regions = stats.get("severe_regions", 0)
            incident.ai_assessment.damage_area_percent = stats.get("damage_area_percent", 0.0)
            incident.ai_assessment.inference_timestamp = datetime.utcnow()
            
            analysis_id = result.get("analysis_id")
            if analysis_id:
                incident.ai_assessment.spatial_output = SpatialOutputInfo(
                    analysis_id=analysis_id,
                    artifacts=result.get("outputs", {})
                )
            
            # Update overall status
            incident.status = IncidentStatus.AI_ASSESSED
            
            incident.updated_at = datetime.utcnow()
            return self.repository.update(incident)
        except Exception as e:
            raise RuntimeError(f"V11 inference failed: {str(e)}")

    def verify_incident(self, incident_id: str, verify_data: VerificationRequest) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        if incident.ai_assessment.status != "AI_ASSESSED":
            raise ValueError("Incident must have a completed AI assessment before verification")
            
        if verify_data.decision not in [VerificationStatus.CONFIRMED, VerificationStatus.CORRECTED, VerificationStatus.REJECTED]:
            raise ValueError("Invalid verification decision")
            
        incident.verification.status = verify_data.decision
        incident.verification.verified = True
        incident.verification.verified_by = verify_data.reviewer_name
        incident.verification.correction_notes = verify_data.notes
        incident.verification.verified_at = datetime.utcnow()
        
        # Mark priority and response plan stale if verification is updated
        if incident.priority.status == "CALCULATED":
            incident.priority.status = "STALE"
            
        if incident.response_plan.status in ["DRAFT", "READY_FOR_APPROVAL", "APPROVED"]:
            incident.response_plan.status = "STALE"
        
        incident.status = IncidentStatus.VERIFIED
        incident.updated_at = datetime.utcnow()
        
        return self.repository.update(incident)

    def calculate_incident_priority(self, incident_id: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        priority_info = PriorityService.calculate_priority(incident)
        incident.priority = priority_info
        incident.updated_at = datetime.utcnow()
        
        # Mark response plan stale if priority is recalculated
        if incident.response_plan.status in ["DRAFT", "READY_FOR_APPROVAL", "APPROVED"]:
            incident.response_plan.status = "STALE"
        
        return self.repository.update(incident)

    def generate_response_plan(self, incident_id: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        plan = ResponseService.generate_response_plan(incident)
        incident.response_plan = plan
        incident.updated_at = datetime.utcnow()
        
        return self.repository.update(incident)
        
    def approve_response_plan(self, incident_id: str, approver_name: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        plan = ResponseService.approve_response_plan(incident, approver_name)
        incident.response_plan = plan
        incident.updated_at = datetime.utcnow()
        
        return self.repository.update(incident)

    def start_coordination(self, incident_id: str, started_by: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
        
        if incident.response_plan.status != ResponsePlanStatus.APPROVED:
            raise ValueError("Response plan must be APPROVED to start coordination")
            
        if incident.response_plan.coordination.status != CoordinationStatus.NOT_STARTED:
            raise ValueError(f"Coordination already started or in state: {incident.response_plan.coordination.status}")
            
        items = []
        for match in incident.response_plan.resource_matches:
            if match.recommended > 0:
                items.append(CoordinationItem(
                    resource_type=match.type,
                    required_quantity=match.recommended,
                    completed_quantity=0
                ))
                
        incident.response_plan.coordination.items = items
        incident.response_plan.coordination.status = CoordinationStatus.IN_PROGRESS
        incident.response_plan.coordination.overall_progress = 0.0
        incident.response_plan.coordination.started_at = datetime.utcnow()
        incident.response_plan.coordination.started_by = started_by
        
        return self.repository.update(incident)

    def update_coordination_progress(self, incident_id: str, resource_type: ResourceType, completed_quantity: int) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        if incident.response_plan.status == ResponsePlanStatus.STALE:
            raise ValueError("Response plan is STALE. Coordination is locked.")
            
        coord = incident.response_plan.coordination
        if coord.status != CoordinationStatus.IN_PROGRESS:
            raise ValueError(f"Cannot update progress in state: {coord.status}")
            
        if completed_quantity < 0:
            raise ValueError("Completed quantity cannot be negative")
            
        target_item = next((item for item in coord.items if item.resource_type == resource_type), None)
        if not target_item:
            raise ValueError(f"Resource type {resource_type} not found in coordination plan")
            
        if completed_quantity > target_item.required_quantity:
            raise ValueError(f"Completed quantity ({completed_quantity}) cannot exceed required quantity ({target_item.required_quantity})")
            
        target_item.completed_quantity = completed_quantity
        
        total_required = sum(item.required_quantity for item in coord.items)
        total_completed = sum(item.completed_quantity for item in coord.items)
        
        if total_required > 0:
            coord.overall_progress = round((total_completed / total_required) * 100, 2)
        else:
            coord.overall_progress = 100.0
            
        return self.repository.update(incident)
        
    def complete_coordination(self, incident_id: str, completed_by: str) -> Incident:
        incident = self.repository.get_by_id(incident_id)
        if not incident:
            raise ValueError("Incident not found")
            
        if incident.response_plan.status == ResponsePlanStatus.STALE:
            raise ValueError("Response plan is STALE. Coordination is locked.")
            
        coord = incident.response_plan.coordination
        if coord.status != CoordinationStatus.IN_PROGRESS:
            raise ValueError(f"Cannot complete coordination in state: {coord.status}")
            
        for item in coord.items:
            if item.completed_quantity < item.required_quantity:
                raise ValueError("Cannot complete coordination while required quantities remain incomplete")
                
        coord.status = CoordinationStatus.COMPLETED
        coord.completed_at = datetime.utcnow()
        coord.completed_by = completed_by
        coord.overall_progress = 100.0
        
        return self.repository.update(incident)

