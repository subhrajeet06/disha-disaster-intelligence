import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200

def test_create_valid_incident():
    payload = {
        "name": "Cyclone Demo",
        "disaster_type": "cyclone",
        "description": "Prototype disaster scenario",
        "area": {
            "district": "Khordha",
            "state": "Odisha",
            "country": "India",
            "latitude": 20.2961,
            "longitude": 85.8245
        }
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Cyclone Demo"
    assert data["disaster_type"] == "cyclone"
    assert data["status"] == "DRAFT"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["ai_assessment"]["status"] == "NOT_RUN"
    assert data["verification"]["status"] == "PENDING"
    assert data["priority"]["level"] is None
    assert data["field_response"]["response_status"] == "NOT_ASSIGNED"
    
    return data["id"]

def test_create_missing_required_field():
    payload = {
        "disaster_type": "cyclone"
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422

def test_create_invalid_disaster_type():
    payload = {
        "name": "Invalid Demo",
        "disaster_type": "invalid_type"
    }
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 422

def test_get_existing_incident():
    incident_id = test_create_valid_incident()
    response = client.get(f"/api/incidents/{incident_id}")
    assert response.status_code == 200
    assert response.json()["id"] == incident_id

def test_get_non_existing_incident():
    response = client.get("/api/incidents/non_existing_id")
    assert response.status_code == 404

def test_list_incidents():
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert "incidents" in data
    assert "count" in data
    assert isinstance(data["incidents"], list)

def test_update_existing_incident():
    incident_id = test_create_valid_incident()
    payload = {
        "name": "Updated Cyclone Demo"
    }
    response = client.patch(f"/api/incidents/{incident_id}", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Cyclone Demo"

def test_update_non_existing_incident():
    payload = {
        "name": "Updated Name"
    }
    response = client.patch("/api/incidents/non_existing_id", json=payload)
    assert response.status_code == 404

def test_inference_endpoint_exists():
    response = client.post("/api/inference")
    # Should fail validation because we didn't pass required files, but ensures the endpoint is there
    assert response.status_code == 422
