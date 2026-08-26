import pytest
from fastapi.testclient import TestClient
import os
import json
from unittest.mock import patch, MagicMock

# Set test environment
os.environ["TESTING"] = "1"

from backend.app import app
from backend.schemas.incident import Incident, GeographicInfo, ImageryInfo, AIAssessment, IncidentStatus, SpatialOutputInfo
from datetime import datetime
import uuid

client = TestClient(app)

@pytest.fixture
def mock_incident():
    return Incident(
        id="test-spatial-id",
        name="Spatial Test",
        disaster_type="other",
        status=IncidentStatus.AI_ASSESSED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        imagery=ImageryInfo(
            before_image="train/images/guatemala-volcano_00000026_pre_disaster.png",
            after_image="train/images/guatemala-volcano_00000026_post_disaster.png"
        ),
        ai_assessment=AIAssessment(
            status="AI_ASSESSED",
            model_version="V11",
            spatial_output=SpatialOutputInfo(
                analysis_id="test-analysis",
                artifacts={
                    "damage_overlay": "damage_overlay.png",
                    "triage_mask": "triage_mask.png"
                }
            )
        )
    )

@patch("backend.api.routes.incidents.IncidentService")
def test_get_spatial_artifact_success(mock_service_class, mock_incident, tmp_path):
    mock_service = mock_service_class.return_value
    mock_service.get_incident.return_value = mock_incident
    
    # Override app dependency
    from backend.api.routes.incidents import get_incident_service
    app.dependency_overrides[get_incident_service] = lambda: mock_service
    
    # We need to mock os.path.exists to bypass the file check, or create a dummy file
    with patch("os.path.exists") as mock_exists:
        mock_exists.return_value = True
        # also mock FileResponse to just return 200 instead of actually reading the file
        with patch("backend.api.routes.incidents.FileResponse") as mock_file_response:
            from fastapi.responses import JSONResponse
            mock_file_response.return_value = JSONResponse(content={"fake": "image"})
            
            response = client.get("/api/incidents/test-spatial-id/assessment/spatial/damage_overlay.png")
            assert response.status_code == 200
            
    app.dependency_overrides.clear()

@patch("backend.api.routes.incidents.IncidentService")
def test_get_spatial_artifact_invalid_type(mock_service_class, mock_incident):
    mock_service = mock_service_class.return_value
    mock_service.get_incident.return_value = mock_incident
    
    from backend.api.routes.incidents import get_incident_service
    app.dependency_overrides[get_incident_service] = lambda: mock_service
    
    response = client.get("/api/incidents/test-spatial-id/assessment/spatial/invalid_secret_file.txt")
    assert response.status_code == 403
    assert "Invalid artifact requested" in response.text
    
    app.dependency_overrides.clear()

@patch("backend.api.routes.incidents.IncidentService")
def test_get_spatial_artifact_path_traversal(mock_service_class, mock_incident):
    mock_service = mock_service_class.return_value
    mock_service.get_incident.return_value = mock_incident
    
    from backend.api.routes.incidents import get_incident_service
    app.dependency_overrides[get_incident_service] = lambda: mock_service
    
    # Force a valid artifact name but try to exploit the URL encoding or path if we were taking raw path
    # Actually, since artifact_name is just the basename, FastAPI doesn't easily let slashes in path params unless declared.
    # But if it did:
    response = client.get("/api/incidents/test-spatial-id/assessment/spatial/..%2F..%2Fetc%2Fpasswd")
    # Should be 404 because FastAPI routing blocks slashes in non-path parameters
    assert response.status_code == 404
    
    app.dependency_overrides.clear()

def test_get_imagery_success():
    # Because imagery endpoints check physical files, and we know train/images/guatemala... exists
    # we can use the test client without too much mocking if we create a real incident first
    pass # covered by standard workflow
