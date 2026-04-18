"""
Routing Engine with enhanced metrics:
  - Dead zone detection (consecutive 0-score segments)
  - Unique tower count along route
  - Signal transition counting
  - Pareto composite cost ranking
"""

import httpx
import numpy as np
from typing import List, Dict, Any
from spatial_engine import SpatialHashEngine
from config import OSRM_BASE_URL, SEARCH_RADIUS_METERS, SIGNAL_WEIGHTS, MAX_ROUTE_POINTS

engine = SpatialHashEngine()


async def fetch_osrm_routes(origin: List[float], destination: List[float]) -> List[Dict]:
    coords = f"{origin[0]},{origin[1]};{destination[0]},{destination[1]}"
    url = (
        f"{OSRM_BASE_URL}/route/v1/driving/{coords}"
        f"?alternatives=3&steps=false&geometries=geojson&overview=full&annotations=false"
    )
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if data.get("code") != "Ok":
        raise ValueError(f"OSRM error: {data.get('message', 'unknown')}")
    return data["routes"]


def downsample_geometry(coords: List[List[float]], max_pts: int) -> np.ndarray:
    arr = np.array(coords)
    if len(arr) > max_pts:
        indices = np.linspace(0, len(arr) - 1, max_pts, dtype=int)
        arr = arr[indices]
    return arr[:, ::-1]  # swap to [lat, lon]


def detect_dead_zones(scores: np.ndarray, latlon_points: np.ndarray) -> List[Dict]:
    """Detect consecutive segments with zero signal coverage."""
    dead_zones = []
    in_dead = False
    dz_start = 0
    total = len(scores)

    for i, score in enumerate(scores):
        if score == 0 and not in_dead:
            in_dead = True
            dz_start = i
        elif score > 0 and in_dead:
            in_dead = False
            dead_zones.append({
                "start_idx": int(dz_start),
                "end_idx": int(i - 1),
                "start_coords": [float(latlon_points[dz_start][0]), float(latlon_points[dz_start][1])],
                "end_coords": [float(latlon_points[i - 1][0]), float(latlon_points[i - 1][1])],
                "length_pct": round((i - dz_start) / total * 100, 2),
            })
    if in_dead:
        dead_zones.append({
            "start_idx": int(dz_start),
            "end_idx": int(total - 1),
            "start_coords": [float(latlon_points[dz_start][0]), float(latlon_points[dz_start][1])],
            "end_coords": [float(latlon_points[-1][0]), float(latlon_points[-1][1])],
            "length_pct": round((total - dz_start) / total * 100, 2),
        })
    return dead_zones


def count_signal_transitions(scores: np.ndarray) -> int:
    """Count significant signal quality changes (score jump >= 3)."""
    transitions = 0
    for i in range(1, len(scores)):
        if abs(scores[i] - scores[i - 1]) >= 3:
            transitions += 1
    return transitions


def score_route(latlon_points: np.ndarray) -> Dict[str, Any]:
    max_signal = float(max(SIGNAL_WEIGHTS.values()))
    scores = engine.query_batch(latlon_points, SEARCH_RADIUS_METERS, SIGNAL_WEIGHTS)
    towers = engine.count_towers_along_route(latlon_points, SEARCH_RADIUS_METERS)
    dead_zones = detect_dead_zones(scores, latlon_points)
    transitions = count_signal_transitions(scores)

    dead_zone_pct = sum(dz["length_pct"] for dz in dead_zones)

    return {
        "connectivity_score": round(float(np.mean(scores) / max_signal * 100), 2),
        "coverage_pct": round(float(np.sum(scores > 0) / len(scores) * 100), 2),
        "point_scores": scores.tolist(),
        "towers_in_range": towers,
        "dead_zone_count": len(dead_zones),
        "dead_zone_pct": round(dead_zone_pct, 2),
        "dead_zones": dead_zones,
        "signal_transitions": transitions,
        "avg_signal": round(float(np.mean(scores)), 2),
    }


async def calculate_routes(
    origin: List[float],
    destination: List[float],
    preference_weight: float
) -> List[Dict[str, Any]]:
    raw_routes = await fetch_osrm_routes(origin, destination)
    max_duration = max(r["duration"] for r in raw_routes) or 1.0

    scored = []
    for i, route in enumerate(raw_routes):
        coords = route["geometry"]["coordinates"]
        latlon = downsample_geometry(coords, MAX_ROUTE_POINTS)
        signal_data = score_route(latlon)

        norm_duration = route["duration"] / max_duration
        norm_connectivity = signal_data["connectivity_score"] / 100.0

        composite_cost = (
            (1 - preference_weight) * norm_duration +
            preference_weight * (1 - norm_connectivity)
        )

        scored.append({
            "id": f"route_{i}",
            "label": "Fastest Route" if i == 0 else f"Alternative {i}",
            "geometry": route["geometry"],
            "distance_m": route["distance"],
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_s": route["duration"],
            "duration_min": round(route["duration"] / 60, 1),
            "connectivity_score": signal_data["connectivity_score"],
            "coverage_pct": signal_data["coverage_pct"],
            "point_scores": signal_data["point_scores"],
            "composite_cost": composite_cost,
            "is_fastest": i == 0,
            "is_most_connected": False,
            "towers_in_range": signal_data["towers_in_range"],
            "dead_zone_count": signal_data["dead_zone_count"],
            "dead_zone_pct": signal_data["dead_zone_pct"],
            "dead_zones": signal_data["dead_zones"],
            "signal_transitions": signal_data["signal_transitions"],
            "avg_signal": signal_data["avg_signal"],
        })

    best_idx = max(range(len(scored)), key=lambda i: scored[i]["connectivity_score"])
    scored[best_idx]["is_most_connected"] = True
    if not scored[best_idx]["is_fastest"]:
        scored[best_idx]["label"] = "Most Connected Route"

    fastest = [r for r in scored if r["is_fastest"]]
    most_connected = [r for r in scored if r["is_most_connected"] and not r["is_fastest"]]
    others = [r for r in scored if not r["is_fastest"] and not r["is_most_connected"]]
    return fastest + most_connected + others
