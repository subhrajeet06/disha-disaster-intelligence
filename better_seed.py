import json
import os
from datetime import datetime

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'data'))
INCIDENTS_FILE = os.path.join(DATA_DIR, 'incidents.json')

def seed():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    incident = {
        "id": "e502649d-9ff2-4509-adb8-087dc839a01c",
        "name": "Guatemala Volcano Disaster",
        "disaster_type": "wildfire",
        "description": "Volcanic eruption in Guatemala resulting in severe damage.",
        "status": "DRAFT",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "area": {
            "district": "Escuintla",
            "state": "Escuintla",
            "country": "Guatemala",
            "latitude": 14.47,
            "longitude": -90.88
        },
        "imagery": {
            "before_image": "train/images/guatemala-volcano_00000000_pre_disaster.png",
            "after_image": "train/images/guatemala-volcano_00000000_post_disaster.png"
        }
    }
    
    with open(INCIDENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump([incident], f, indent=2)
        
    print("Seeded incident successfully.")

if __name__ == '__main__':
    seed()
