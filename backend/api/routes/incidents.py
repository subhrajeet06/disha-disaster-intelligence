from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
import os
from typing import List, Dict, Any
from backend.schemas.incident import (
    IncidentCreate, IncidentUpdate, IncidentResponse,
    VerificationRequest, ApprovePlanRequest,
    CoordinationStartRequest, CoordinationProgressUpdate, CoordinationCompleteRequest
)
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

@router.post("/{incident_id}/assess", response_model=IncidentResponse)
def assess_incident(
    incident_id: str,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.assess_incident(incident_id)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{incident_id}/verify", response_model=IncidentResponse)
def verify_incident(
    incident_id: str,
    verify_data: VerificationRequest,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.verify_incident(incident_id, verify_data)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{incident_id}/priority", response_model=IncidentResponse)
def calculate_priority(
    incident_id: str,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.calculate_incident_priority(incident_id)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class ApprovePlanRequest(BaseModel):
    approver_name: str

@router.post("/{incident_id}/response-plan", response_model=IncidentResponse)
def generate_response_plan(
    incident_id: str,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.generate_response_plan(incident_id)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{incident_id}/response-plan/approve", response_model=IncidentResponse)
def approve_response_plan(
    incident_id: str,
    payload: ApprovePlanRequest,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.approve_response_plan(incident_id, payload.approver_name)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{incident_id}/response-plan/coordination/start", response_model=IncidentResponse)
def start_coordination(
    incident_id: str,
    payload: CoordinationStartRequest,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.start_coordination(incident_id, payload.started_by)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{incident_id}/response-plan/coordination", response_model=IncidentResponse)
def update_coordination_progress(
    incident_id: str,
    payload: CoordinationProgressUpdate,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.update_coordination_progress(incident_id, payload.resource_type, payload.completed_quantity)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{incident_id}/response-plan/coordination/complete", response_model=IncidentResponse)
def complete_coordination(
    incident_id: str,
    payload: CoordinationCompleteRequest,
    service: IncidentService = Depends(get_incident_service)
):
    try:
        incident = service.complete_coordination(incident_id, payload.completed_by)
        return incident
    except ValueError as e:
        if str(e) == "Incident not found":
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{incident_id}/assessment/spatial/{artifact_name}")
def get_spatial_artifact(
    incident_id: str,
    artifact_name: str,
    service: IncidentService = Depends(get_incident_service)
):
    incident = service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    if incident.ai_assessment.status != "AI_ASSESSED" or not incident.ai_assessment.spatial_output:
        raise HTTPException(status_code=404, detail="Spatial analysis not available for this incident")
        
    spatial = incident.ai_assessment.spatial_output
    
    # Path traversal protection: only allow known artifacts mapped in the JSON
    valid_artifacts = list(spatial.artifacts.values())
    
    # Also explicitly whitelist allowed filenames just in case
    allowed_names = [
        "raw_5class_mask.png", 
        "damage_mask.png", 
        "triage_mask.png", 
        "damage_probability.png", 
        "damage_overlay.png", 
        "inference_summary.png"
    ]
    
    if artifact_name not in valid_artifacts or artifact_name not in allowed_names:
        raise HTTPException(status_code=403, detail="Invalid artifact requested")
        
    # Construct absolute path safely
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    artifact_path = os.path.abspath(os.path.join(project_root, "outputs", "inference", spatial.analysis_id, artifact_name))
    
    # Final safety check
    if not artifact_path.startswith(os.path.abspath(os.path.join(project_root, "outputs", "inference"))):
        raise HTTPException(status_code=403, detail="Path traversal attempt blocked")
        
    if not os.path.exists(artifact_path):
        raise HTTPException(status_code=404, detail="Artifact file not found on server")
        
    return FileResponse(artifact_path)

@router.get("/{incident_id}/imagery/{img_type}")
def get_incident_imagery(
    incident_id: str,
    img_type: str,
    service: IncidentService = Depends(get_incident_service)
):
    incident = service.get_incident(incident_id)
    if not incident or not incident.imagery:
        raise HTTPException(status_code=404, detail="Incident or imagery not found")
        
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    
    if img_type == "before" and incident.imagery.before_image:
        path = os.path.abspath(os.path.join(project_root, incident.imagery.before_image))
    elif img_type == "after" and incident.imagery.after_image:
        path = os.path.abspath(os.path.join(project_root, incident.imagery.after_image))
    else:
        raise HTTPException(status_code=404, detail="Requested imagery type not found")
        
    if not path.startswith(project_root) or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image file not found on server")
        
    return FileResponse(path)
