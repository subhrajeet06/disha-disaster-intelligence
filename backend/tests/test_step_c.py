import pytest
from fastapi.testclient import TestClient
from backend.app import app
from backend.schemas.incident import IncidentCreate, IncidentStatus, DisasterType, GeographicInfo, ImageryInfo
import os
import json
from unittest.mock import patch

client = TestClient(app)

@pytest.fixture
def clean_db():
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'incidents.json'))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with open(db_path, 'w') as f:
        json.dump([], f)
    yield
    with open(db_path, 'w') as f:
        json.dump([], f)

@patch("backend.services.incident_service.inference_service")
@patch("os.path.exists")
def test_assess_incident_success(mock_exists, mock_inference, clean_db):
    # Setup mock to say files exist
    mock_exists.return_value = True
    
    # Mock inference to return dummy data
    mock_inference.run_analysis.return_value = ({
        "statistics": {
            "damage_regions": 2,
            "severe_regions": 1,
            "damage_area_percent": 15.5
        }
    }, "/outputs/dummy")
    
    # 1. Create incident with imagery
    response = client.post("/api/incidents", json={
        "name": "Test Assess",
        "disaster_type": "flood",
        "imagery": {
            "before_image": "train/images/dummy_pre.png",
            "after_image": "train/images/dummy_post.png"
        }
    })
    assert response.status_code == 201, response.text
    incident_id = response.json()["id"]
    
    # 2. Call assess
    response = client.post(f"/api/incidents/{incident_id}/assess")
    assert response.status_code == 200
    data = response.json()
    
    # 3. Assertions
    assert data["status"] == "AI_ASSESSED"
    assert data["ai_assessment"]["status"] == "AI_ASSESSED"
    assert data["ai_assessment"]["model_version"] == "V11"
    assert data["ai_assessment"]["damage_regions"] == 2
    assert data["ai_assessment"]["severe_regions"] == 1
    assert data["ai_assessment"]["damage_area_percent"] == 15.5

def test_assess_incident_not_found(clean_db):
    response = client.post("/api/incidents/nonexistent/assess")
    assert response.status_code == 404

def test_assess_incident_no_imagery(clean_db):
    response = client.post("/api/incidents", json={
        "name": "No Imagery",
        "disaster_type": "flood"
    })
    incident_id = response.json()["id"]
    
    response = client.post(f"/api/incidents/{incident_id}/assess")
    assert response.status_code == 422
    assert "both before and after imagery" in response.json()["detail"]

def test_assess_incident_path_traversal(clean_db):
    response = client.post("/api/incidents", json={
        "name": "Hacked",
        "disaster_type": "flood",
        "imagery": {
            "before_image": "../../../etc/passwd",
            "after_image": "train/images/dummy_post.png"
        }
    })
    incident_id = response.json()["id"]
    
    response = client.post(f"/api/incidents/{incident_id}/assess")
    assert response.status_code == 422
    assert "Invalid imagery path" in response.json()["detail"]
