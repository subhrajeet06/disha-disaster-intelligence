import json
import os
from datetime import datetime
from typing import List

from backend.schemas.incident import (
    Incident, ResponsePlanInfo, ResponsePlanStatus, ResponseRequirement, 
    ResourceMatch, UnmetRequirement, ResourceType, PriorityLevel
)

class ResponseService:
    RESOURCES_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'resources.json')
    
    @classmethod
    def get_resources(cls) -> List[dict]:
        try:
            with open(cls.RESOURCES_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []

    @classmethod
    def generate_response_plan(cls, incident: Incident) -> ResponsePlanInfo:
        # 1. Validation
        if incident.verification.status not in ["CONFIRMED", "CORRECTED"] or not incident.verification.verified:
            raise ValueError("Incident must have CONFIRMED or CORRECTED human verification to generate a response plan.")
            
        if incident.priority.status != "CALCULATED":
            raise ValueError("Incident must have a valid CALCULATED priority.")
            
        # 2. Extract Data
        ai = incident.ai_assessment
        priority_level = incident.priority.level
        severe_regions = ai.severe_regions
        damage_regions = ai.damage_regions
        damage_area_percent = ai.damage_area_percent
        
        requirements = []
        
        # Rule A: Search & Rescue
        if severe_regions > 0:
            requirements.append(ResponseRequirement(
                type=ResourceType.SEARCH_AND_RESCUE,
                recommended_quantity=severe_regions * 2,
                reason=f"Search and rescue recommended due to {severe_regions} verified severe damage regions.",
                priority=PriorityLevel.CRITICAL
            ))
            
        # Rule B: Medical Team
        if priority_level == PriorityLevel.CRITICAL:
            requirements.append(ResponseRequirement(
                type=ResourceType.MEDICAL_TEAM,
                recommended_quantity=max(1, damage_regions * 2),
                reason="Critical priority requires extensive medical support.",
                priority=PriorityLevel.CRITICAL
            ))
        elif priority_level == PriorityLevel.HIGH:
            requirements.append(ResponseRequirement(
                type=ResourceType.MEDICAL_TEAM,
                recommended_quantity=max(1, damage_regions),
                reason="High priority requires medical support.",
                priority=PriorityLevel.HIGH
            ))
        elif severe_regions > 0:
            requirements.append(ResponseRequirement(
                type=ResourceType.MEDICAL_TEAM,
                recommended_quantity=1,
                reason="Medical team recommended due to severe damage presence.",
                priority=PriorityLevel.MEDIUM
            ))
            
        # Rule C: Shelter & Food/Water
        if damage_area_percent > 20.0:
            shelter_qty = int(damage_area_percent * 10)
            requirements.append(ResponseRequirement(
                type=ResourceType.SHELTER,
                recommended_quantity=shelter_qty,
                reason=f"Widespread damage ({damage_area_percent:.1f}%) necessitates temporary shelter.",
                priority=priority_level
            ))
            requirements.append(ResponseRequirement(
                type=ResourceType.FOOD_WATER,
                recommended_quantity=shelter_qty * 2,
                reason=f"Widespread damage ({damage_area_percent:.1f}%) necessitates food and water supplies.",
                priority=priority_level
            ))
            
        # Rule D: Road Clearance
        if damage_regions > 0 and priority_level in [PriorityLevel.HIGH, PriorityLevel.CRITICAL]:
            requirements.append(ResponseRequirement(
                type=ResourceType.ROAD_CLEARANCE,
                recommended_quantity=min(3, damage_regions),
                reason="Road clearance recommended due to significant damage scope.",
                priority=PriorityLevel.HIGH
            ))

        # 3. Matching
        resources = cls.get_resources()
        available_totals = {}
        for res in resources:
            if res.get("status") == "AVAILABLE":
                rtype = res.get("type")
                available_totals[rtype] = available_totals.get(rtype, 0) + res.get("quantity_available", 0)
                
        matches = []
        unmet = []
        
        for req in requirements:
            available = available_totals.get(req.type.value, 0)
            recommended = min(req.recommended_quantity, available)
            
            matches.append(ResourceMatch(
                type=req.type,
                required=req.recommended_quantity,
                available=available,
                recommended=recommended
            ))
            
            unmet_qty = req.recommended_quantity - recommended
            if unmet_qty > 0:
                unmet.append(UnmetRequirement(
                    type=req.type,
                    unmet_quantity=unmet_qty
                ))
                
        return ResponsePlanInfo(
            status=ResponsePlanStatus.READY_FOR_APPROVAL,
            requirements=requirements,
            resource_matches=matches,
            unmet_requirements=unmet,
            created_at=datetime.utcnow()
        )

    @classmethod
    def approve_response_plan(cls, incident: Incident, approver_name: str) -> ResponsePlanInfo:
        if incident.response_plan.status != ResponsePlanStatus.READY_FOR_APPROVAL:
            raise ValueError("Response plan must be in READY_FOR_APPROVAL state to be approved.")
            
        plan = incident.response_plan
        plan.status = ResponsePlanStatus.APPROVED
        plan.approved_by = approver_name
        plan.approved_at = datetime.utcnow()
        plan.updated_at = datetime.utcnow()
        return plan
