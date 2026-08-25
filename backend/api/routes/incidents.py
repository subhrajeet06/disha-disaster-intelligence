from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any
from backend.schemas.incident import IncidentCreate, IncidentUpdate, IncidentResponse
from backend.services.incident_service import IncidentService
from backend.repositories.incident_repository import IncidentRepository

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"]
)

# Dependency injection for the service
def get_incident_service() -> IncidentService:
    repository = IncidentRepository()
    return IncidentService(repository)

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    incident_in: IncidentCreate, 
    service: IncidentService = Depends(get_incident_service)
):
    try:
        return service.create_incident(incident_in)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.get("", response_model=Dict[str, Any])
def list_incidents(
    service: IncidentService = Depends(get_incident_service)
):
    incidents = service.get_all_incidents()
    return {
        "incidents": incidents,
        "count": len(incidents)
    }

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    service: IncidentService = Depends(get_incident_service)
):
    incident = service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/{incident_id}", response_model=IncidentResponse)
@router.put("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: str,
    incident_in: IncidentUpdate,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.update_incident(incident_id, incident_in)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        return incident
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{incident_id}", status_code=status.HTTP_200_OK)
def delete_incident(
    incident_id: str,
    service: IncidentService = Depends(get_incident_service)
):
    success = service.delete_incident(incident_id)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": "success", "message": "Incident deleted"}
