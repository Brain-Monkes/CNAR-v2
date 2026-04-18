from pydantic import BaseModel, Field
from typing import List


class RouteRequest(BaseModel):
    origin: List[float] = Field(..., description="[lon, lat] OSRM convention")
    destination: List[float] = Field(..., description="[lon, lat] OSRM convention")
    preference_weight: float = Field(0.5, ge=0.0, le=1.0)


class RouteResponse(BaseModel):
    id: str
    label: str
    geometry: dict
    distance_km: float
    duration_min: float
    connectivity_score: float      # 0-100
    coverage_pct: float            # 0-100
    point_scores: List[float]
    composite_cost: float
    is_fastest: bool
    is_most_connected: bool
