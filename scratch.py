from fastapi.testclient import TestClient
from backend.app import app
import os

client = TestClient(app)

res = client.post("/api/incidents/", json={"name": "Step H Test", "disaster_type": "flood"})
inc_id = res.json()["id"]

res_patch = client.patch(f"/api/incidents/{inc_id}/imagery", json={"before_image": "test.jpg", "after_image": "test.jpg"})
print("PATCH:", res_patch.status_code, res_patch.text)

from unittest.mock import patch
with patch('backend.services.incident_service.inference_service.run_analysis') as mock_inf:
    mock_inf.return_value = {
        "status": "COMPLETED",
        "damage_regions": 10,
        "severe_regions": 2,
        "damage_area_percent": 15.0,
        "spatial_output": {"analysis_id": "test", "artifacts": {}}
    }
    res_assess = client.post(f"/api/incidents/{inc_id}/assess")
    print("ASSESS:", res_assess.status_code, res_assess.text)
    
res_verify = client.post(f"/api/incidents/{inc_id}/verify", json={"decision": "CONFIRMED", "reviewer_name": "Test User"})
print("VERIFY:", res_verify.status_code, res_verify.text)

res_prior = client.post(f"/api/incidents/{inc_id}/priority")
print("PRIORITY:", res_prior.json())

res_plan = client.post(f"/api/incidents/{inc_id}/response-plan")
print("PLAN:", res_plan.status_code, res_plan.text)

res_approve = client.post(f"/api/incidents/{inc_id}/response-plan/approve", json={"approver_name": "Approver"})
print("APPROVE:", res_approve.status_code, res_approve.text)
