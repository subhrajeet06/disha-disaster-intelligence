import os
import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.incident import (
    Incident, 
    IncidentCreate, 
    IncidentUpdate, 
    IncidentStatus,
    SpatialOutputInfo
)
from backend.repositories.incident_repository import IncidentRepository
from backend import inference_service

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

