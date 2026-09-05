from datetime import datetime
from backend.schemas.incident import Incident, PriorityInfo, PriorityFactor, PriorityLevel

class PriorityService:
    @staticmethod
    def calculate_priority(incident: Incident) -> PriorityInfo:
        # Validate that the incident has been human-verified
        if incident.verification.status not in ["CONFIRMED", "CORRECTED"]:
            raise ValueError("Incident must have CONFIRMED or CORRECTED human verification to calculate priority")
        
        if not incident.verification.verified:
            raise ValueError("Incident human verification is incomplete")
            
        ai = incident.ai_assessment
        
        # Helper to safely handle optional/missing numeric values
        def safe_float(val) -> float:
            try:
                if val is None:
                    return 0.0
                return max(0.0, float(val))
            except (ValueError, TypeError):
                return 0.0
                
        def safe_int(val) -> int:
            try:
                if val is None:
                    return 0
                return max(0, int(val))
            except (ValueError, TypeError):
                return 0

        # Extract values
        damage_area_percent = safe_float(ai.damage_area_percent)
        severe_regions = safe_int(ai.severe_regions)
        damage_regions = safe_int(ai.damage_regions)
        
        factors = []
        
        # 1. Damage Area Factor (Max 40 points)
        # 50% damage or more = 40 points
        area_pts = min((damage_area_percent / 50.0) * 40.0, 40.0)
        area_pts_rounded = round(area_pts)
        factors.append(PriorityFactor(
            name="Damage Area",
            value=f"{damage_area_percent:.1f}%",
            contribution=area_pts_rounded
        ))
        
        # 2. Severe Regions Factor (Max 40 points)
        # 1 region = 10 points, 4+ = 40 points
        severe_pts = min(severe_regions * 10.0, 40.0)
        severe_pts_rounded = round(severe_pts)
        factors.append(PriorityFactor(
            name="Severe Regions",
            value=str(severe_regions),
            contribution=severe_pts_rounded
        ))
        
        # 3. Overall Affected Regions (Max 20 points)
        # Each region = 4 points, 5+ = 20 points
        region_pts = min(damage_regions * 4.0, 20.0)
        region_pts_rounded = round(region_pts)
        factors.append(PriorityFactor(
            name="Affected Regions",
            value=str(damage_regions),
            contribution=region_pts_rounded
        ))
        
        # Calculate final risk score
        risk_score = area_pts_rounded + severe_pts_rounded + region_pts_rounded
        # Clamp between 0 and 100 just in case
        risk_score = max(0, min(100, risk_score))
        
        # Determine Priority Level
        if risk_score < 25:
            level = PriorityLevel.LOW
        elif risk_score < 50:
            level = PriorityLevel.MEDIUM
        elif risk_score < 75:
            level = PriorityLevel.HIGH
        else:
            level = PriorityLevel.CRITICAL
            
        return PriorityInfo(
            status="CALCULATED",
            risk_score=risk_score,
            level=level,
            factors=factors,
            calculated_at=datetime.utcnow(),
            scoring_version="F1"
        )
