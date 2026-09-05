import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import json
from backend.schemas.incident import Incident, VerificationRequest, VerificationStatus
from backend.services.priority_service import PriorityService

client = TestClient(app)

import tempfile
import shutil

@pytest.fixture
def clean_db():
    temp_dir = tempfile.mkdtemp()
    temp_file = os.path.join(temp_dir, 'incidents.json')
    with open(temp_file, 'w') as f:
        json.dump([], f)
    
    from unittest.mock import patch
    with patch("backend.repositories.incident_repository.IncidentRepository.FILE_PATH", temp_file):
        yield
        
    shutil.rmtree(temp_dir)

def test_priority_service_logic():
    # Test internal logic directly
    incident = Incident(
        id="test-1",
        name="Test",
        disaster_type="earthquake",
        created_at="2026-08-26T12:00:00Z",
        updated_at="2026-08-26T12:00:00Z"
    )
    incident.verification.status = "CONFIRMED"
    incident.verification.verified = True
    
    # 1. Zero damage
    incident.ai_assessment.damage_area_percent = 0
    incident.ai_assessment.severe_regions = 0
    incident.ai_assessment.damage_regions = 0
    
    priority = PriorityService.calculate_priority(incident)
    assert priority.risk_score == 0
    assert priority.level == "LOW"
    
    # 2. Maximum damage
    incident.ai_assessment.damage_area_percent = 100
    incident.ai_assessment.severe_regions = 10
    incident.ai_assessment.damage_regions = 20
    
    priority = PriorityService.calculate_priority(incident)
    assert priority.risk_score == 100
    assert priority.level == "CRITICAL"
    
    # 3. Intermediate (Medium)
    # Area: 10% -> (10/50)*40 = 8
    # Severe: 1 -> 10
    # Regions: 2 -> 8
    # Total = 26 (Medium)
    incident.ai_assessment.damage_area_percent = 10
    incident.ai_assessment.severe_regions = 1
    incident.ai_assessment.damage_regions = 2
    
    priority = PriorityService.calculate_priority(incident)
    assert priority.risk_score == 26
    assert priority.level == "MEDIUM"

def test_priority_endpoint_success(clean_db):
    # 1. Create incident
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    # 2. Assess
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({"statistics": {"damage_area_percent": 60, "severe_regions": 4, "damage_regions": 5}}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    # 3. Verify (Confirmed)
    client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "CONFIRMED", "reviewer_name": "Test"})
    
    # 4. Calculate Priority
    resp = client.post(f"/api/incidents/{inc_id}/priority")
    assert resp.status_code == 200
    data = resp.json()
    assert data["priority"]["status"] == "CALCULATED"
    assert data["priority"]["risk_score"] == 100 # 60% area (>50) -> 40, 4 severe -> 40, 5 damage -> 20. 40+40+20=100
    assert data["priority"]["level"] == "CRITICAL"
    
def test_priority_endpoint_unverified(clean_db):
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    resp = client.post(f"/api/incidents/{inc_id}/priority")
    assert resp.status_code == 422
    assert "Incident must have CONFIRMED or CORRECTED human verification" in resp.json()["detail"]

def test_priority_endpoint_rejected(clean_db):
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "REJECTED", "reviewer_name": "Test"})
    
    resp = client.post(f"/api/incidents/{inc_id}/priority")
    assert resp.status_code == 422
    assert "Incident must have CONFIRMED or CORRECTED human verification" in resp.json()["detail"]

def test_priority_stale_logic(clean_db):
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "CONFIRMED", "reviewer_name": "Test"})
    client.post(f"/api/incidents/{inc_id}/priority")
    
    # Update verification
    resp = client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "CORRECTED", "reviewer_name": "Test"})
    assert resp.status_code == 200
    
    # Priority should be stale
    data = resp.json()
    assert data["priority"]["status"] == "STALE"
