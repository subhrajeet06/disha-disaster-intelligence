import json
import os
from typing import List, Optional
from pydantic import ValidationError
from backend.schemas.incident import Incident

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data'))
INCIDENTS_FILE = os.path.join(DATA_DIR, 'incidents.json')

class IncidentRepository:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        if not os.path.exists(INCIDENTS_FILE):
            with open(INCIDENTS_FILE, 'w') as f:
                json.dump([], f)
                
    def _read_data(self) -> List[Incident]:
        try:
            with open(INCIDENTS_FILE, 'r') as f:
                data = json.load(f)
                return [Incident(**item) for item in data]
        except (json.JSONDecodeError, ValidationError):
            return []
            
    def _write_data(self, incidents: List[Incident]):
        with open(INCIDENTS_FILE, 'w') as f:
            # We serialize using Pydantic's model_dump (Pydantic v2) or dict() (Pydantic v1)
            json.dump([incident.model_dump(mode='json') if hasattr(incident, 'model_dump') else incident.dict() for incident in incidents], f, indent=2)

    def get_all(self) -> List[Incident]:
        return self._read_data()

    def get_by_id(self, incident_id: str) -> Optional[Incident]:
        incidents = self._read_data()
        for inc in incidents:
            if inc.id == incident_id:
                return inc
        return None

    def create(self, incident: Incident) -> Incident:
        incidents = self._read_data()
        incidents.append(incident)
        self._write_data(incidents)
        return incident

    def update(self, updated_incident: Incident) -> Incident:
        incidents = self._read_data()
        for i, inc in enumerate(incidents):
            if inc.id == updated_incident.id:
                incidents[i] = updated_incident
                self._write_data(incidents)
                return updated_incident
        raise ValueError(f"Incident {updated_incident.id} not found")

    def delete(self, incident_id: str) -> bool:
        incidents = self._read_data()
        for i, inc in enumerate(incidents):
            if inc.id == incident_id:
                del incidents[i]
                self._write_data(incidents)
                return True
        return False
