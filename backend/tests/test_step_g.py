import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import json

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
    with patch("backend.repositories.incident_repository.INCIDENTS_FILE", temp_file):
        yield
        
    shutil.rmtree(temp_dir)

def setup_incident():
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({"statistics": {"damage_area_percent": 60, "severe_regions": 4, "damage_regions": 5}}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "CONFIRMED", "reviewer_name": "Test", "notes": "Verified"})
    client.post(f"/api/incidents/{inc_id}/priority")
    return inc_id

def test_generate_response_plan_success(clean_db):
    incident_id = setup_incident()
    
    response = client.post(f"/api/incidents/{incident_id}/response-plan")
    assert response.status_code == 200
    data = response.json()
    
    plan = data.get("response_plan")
    assert plan is not None
    assert plan["status"] == "READY_FOR_APPROVAL"
    assert len(plan["requirements"]) > 0
    assert len(plan["resource_matches"]) > 0

def test_approve_response_plan_success(clean_db):
    incident_id = setup_incident()
    
    # Generate first
    client.post(f"/api/incidents/{incident_id}/response-plan")
    
    approve_payload = {
        "approver_name": "Test Approver"
    }
    response = client.post(f"/api/incidents/{incident_id}/response-plan/approve", json=approve_payload)
    assert response.status_code == 200
    data = response.json()
    
    plan = data.get("response_plan")
    assert plan["status"] == "APPROVED"
    assert plan["approved_by"] == "Test Approver"

def test_stale_plan_on_priority_recalculation(clean_db):
    incident_id = setup_incident()
    client.post(f"/api/incidents/{incident_id}/response-plan")
    
    # Recalculate priority
    response = client.post(f"/api/incidents/{incident_id}/priority")
    assert response.status_code == 200
    
    # Check plan is stale
    data = response.json()
    assert data["response_plan"]["status"] == "STALE"

def test_stale_plan_on_verification(clean_db):
    incident_id = setup_incident()
    client.post(f"/api/incidents/{incident_id}/response-plan")
    
    # Re-verify
    verify_payload = {
        "decision": "CONFIRMED",
        "notes": "Re-verified",
        "reviewer_name": "Test Reviewer 2"
    }
    response = client.post(f"/api/incidents/{incident_id}/verify", json=verify_payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["response_plan"]["status"] == "STALE"

def test_cannot_generate_on_rejected_verification(clean_db):
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({"statistics": {"damage_area_percent": 60, "severe_regions": 4, "damage_regions": 5}}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "REJECTED", "reviewer_name": "Rejector"})
    
    response = client.post(f"/api/incidents/{inc_id}/response-plan")
    assert response.status_code == 422
    assert "Incident must have CONFIRMED or CORRECTED" in response.json()["detail"]
