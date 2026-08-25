import uuid
from datetime import datetime
from typing import List, Optional
from backend.schemas.incident import (
    Incident, 
    IncidentCreate, 
    IncidentUpdate, 
    IncidentStatus
)
from backend.repositories.incident_repository import IncidentRepository

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
