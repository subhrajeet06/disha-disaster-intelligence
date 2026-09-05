import pytest
from fastapi.testclient import TestClient
from backend.app import app
import os
import json
import tempfile
import shutil

client = TestClient(app)

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

def create_fully_approved_incident(clean_db):
    res = client.post("/api/incidents", json={
        "name": "Step H Test",
        "disaster_type": "flood",
        "imagery": {"before_image": "test.jpg", "after_image": "test.jpg"}
    })
    inc_id = res.json()["id"]
    
    from unittest.mock import patch
    with patch("os.path.exists", return_value=True), patch("backend.services.incident_service.inference_service.run_analysis", return_value=({"statistics": {"damage_area_percent": 15.0, "severe_regions": 2, "damage_regions": 10}}, "/outputs/dummy")):
        client.post(f"/api/incidents/{inc_id}/assess")
        
    # Step E
    client.post(f"/api/incidents/{inc_id}/verify", json={
        "decision": "CONFIRMED",
        "reviewer_name": "Test User"
    })
    
    # Step F
    client.post(f"/api/incidents/{inc_id}/priority")
    
    # Step G
    client.post(f"/api/incidents/{inc_id}/response-plan")
    client.post(f"/api/incidents/{inc_id}/response-plan/approve", json={
        "approver_name": "Approver"
    })
    
    return inc_id

def test_start_coordination(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    
    res = client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    assert res.status_code == 200
    data = res.json()
    assert data["response_plan"]["coordination"]["status"] == "IN_PROGRESS"
    assert data["response_plan"]["coordination"]["started_by"] == "Coord"
    assert len(data["response_plan"]["coordination"]["items"]) > 0

def test_start_coordination_without_approval(clean_db):
    res = client.post("/api/incidents", json={
        "name": "Step H Test Unapproved",
        "disaster_type": "flood"
    })
    inc_id = res.json()["id"]
    
    res = client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    assert res.status_code == 422
    assert "APPROVED" in res.json()["detail"]

def test_update_progress(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    
    res = client.get(f"/api/incidents/{inc_id}")
    items = res.json()["response_plan"]["coordination"]["items"]
    target = items[0]
    
    res2 = client.patch(f"/api/incidents/{inc_id}/response-plan/coordination", json={
        "resource_type": target["resource_type"],
        "completed_quantity": 1
    })
    assert res2.status_code == 200
    updated_items = res2.json()["response_plan"]["coordination"]["items"]
    updated_target = next(i for i in updated_items if i["resource_type"] == target["resource_type"])
    assert updated_target["completed_quantity"] == 1
    assert res2.json()["response_plan"]["coordination"]["overall_progress"] > 0

def test_over_target_progress_rejected(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    
    res = client.get(f"/api/incidents/{inc_id}")
    items = res.json()["response_plan"]["coordination"]["items"]
    target = items[0]
    
    res2 = client.patch(f"/api/incidents/{inc_id}/response-plan/coordination", json={
        "resource_type": target["resource_type"],
        "completed_quantity": target["required_quantity"] + 1
    })
    assert res2.status_code == 422
    assert "cannot exceed" in res2.json()["detail"]

def test_complete_coordination_valid(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    
    res = client.get(f"/api/incidents/{inc_id}")
    items = res.json()["response_plan"]["coordination"]["items"]
    
    for item in items:
        client.patch(f"/api/incidents/{inc_id}/response-plan/coordination", json={
            "resource_type": item["resource_type"],
            "completed_quantity": item["required_quantity"]
        })
        
    res2 = client.post(f"/api/incidents/{inc_id}/response-plan/coordination/complete", json={"completed_by": "Completer"})
    assert res2.status_code == 200
    assert res2.json()["response_plan"]["coordination"]["status"] == "COMPLETED"
    assert res2.json()["response_plan"]["coordination"]["overall_progress"] == 100.0

def test_complete_coordination_invalid_incomplete(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    
    res2 = client.post(f"/api/incidents/{inc_id}/response-plan/coordination/complete", json={"completed_by": "Completer"})
    assert res2.status_code == 422
    assert "incomplete" in res2.json()["detail"]

def test_stale_invalidation(clean_db):
    inc_id = create_fully_approved_incident(clean_db)
    client.post(f"/api/incidents/{inc_id}/response-plan/coordination/start", json={"started_by": "Coord"})
    
    # Change verification decision to make it STALE
    client.post(f"/api/incidents/{inc_id}/verify", json={
        "decision": "CORRECTED",
        "reviewer_name": "Test User"
    })
    
    res = client.get(f"/api/incidents/{inc_id}")
    assert res.json()["response_plan"]["status"] == "STALE"
    
    res2 = client.post(f"/api/incidents/{inc_id}/response-plan/coordination/complete", json={"completed_by": "Completer"})
    assert res2.status_code == 422
    assert "STALE" in res2.json()["detail"]
