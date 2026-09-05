import requests
import time

base_url = "http://localhost:8000/api/incidents"

def update_incident():
    res = requests.get(base_url)
    incidents = res.json()
    if not incidents:
        print("No incidents found")
        return
        
    inc_id = incidents[0]["id"]
    print(f"Updating Incident {inc_id}")
    
    res = requests.put(f"{base_url}/{inc_id}/imagery", json={
        "before_image": "fani_before.jpg",
        "after_image": "fani_after.jpg"
    })
    
    print("Seeded incident imagery:", res.json().get("name"))

if __name__ == "__main__":
    update_incident()
