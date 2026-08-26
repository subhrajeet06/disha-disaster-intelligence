import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import json

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

def test_verify_incident_success(clean_db):
    # 1. Create
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    # 2. Mock inference to bypass file checks and model running
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({}, "/outputs/dummy")):
        resp = client.post(f"/api/incidents/{inc_id}/assess")
        assert resp.status_code == 200
        
    # 3. Verify
    verify_payload = {
        "decision": "CONFIRMED",
        "reviewer_name": "Test Reviewer",
        "notes": "Looks good"
    }
    resp = client.post(f"/api/incidents/{inc_id}/verify", json=verify_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "VERIFIED"
    assert data["verification"]["status"] == "CONFIRMED"
    assert data["verification"]["verified"] is True
    assert data["verification"]["verified_by"] == "Test Reviewer"
    assert data["verification"]["correction_notes"] == "Looks good"
    assert "verified_at" in data["verification"]

def test_verify_incident_not_assessed(clean_db):
    # Create incident without assessing
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood"})
    inc_id = resp.json()["id"]
    
    verify_payload = {
        "decision": "CONFIRMED",
        "reviewer_name": "Test Reviewer"
    }
    resp = client.post(f"/api/incidents/{inc_id}/verify", json=verify_payload)
    assert resp.status_code == 422
    assert "completed AI assessment" in resp.json()["detail"]

def test_verify_incident_invalid_decision(clean_db):
    # Needs assessment to reach invalid decision test
    resp = client.post("/api/incidents", json={"name": "Test", "disaster_type": "flood", "imagery": {"before_image": "a", "after_image": "b"}})
    inc_id = resp.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    verify_payload = {
        "decision": "INVALID",
        "reviewer_name": "Test Reviewer"
    }
    resp = client.post(f"/api/incidents/{inc_id}/verify", json=verify_payload)
    # Should fail pydantic schema validation first (422) since we used Enum in schema
    assert resp.status_code == 422

def test_verify_incident_not_found(clean_db):
    resp = client.post("/api/incidents/nonexistent/verify", json={"decision": "CONFIRMED", "reviewer_name": "Test"})
    assert resp.status_code == 404
