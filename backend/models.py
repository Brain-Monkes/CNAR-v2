from pydantic import BaseModel
from typing import List, Optional


class RouteRequest(BaseModel):
    origin: List[float]                             # [lon, lat]
    destination: List[float]                        # [lon, lat]
    waypoints: Optional[List[List[float]]] = None   # [[lon, lat], ...]
    preference_weight: float = 0.5
    active_radios: Optional[List[str]] = None       # e.g. ["4G", "5G"]
    active_operators: Optional[List[str]] = None    # e.g. ["Jio", "AirTel"]
