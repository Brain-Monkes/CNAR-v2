import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from spatial_engine import SpatialHashEngine
from routing import calculate_routes
from models import RouteRequest
from config import CORS_ORIGINS, TOWER_CSV_PATH, SEARCH_RADIUS_METERS

engine = SpatialHashEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.initialize(TOWER_CSV_PATH, cell_size_m=SEARCH_RADIUS_METERS)
    yield


app = FastAPI(title="CNAR Backend", version="2.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "towers_loaded": engine._initialized}


@app.get("/towers/heatmap")
async def towers_heatmap(limit: int = 50000):
    if not engine._initialized:
        raise HTTPException(503, "Spatial engine not ready")
    return engine.get_heatmap_data(max_towers=limit)


@app.post("/calculate-routes")
async def route_endpoint(req: RouteRequest):
    try:
        result = await calculate_routes(
            req.origin, req.destination, req.preference_weight,
            req.waypoints, req.active_radios, req.active_operators
        )
        return {
            "routes": result["routes"],
            "count": len(result["routes"]),
            "route_towers": result["route_towers"],
        }
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Routing failed: {str(e)}")


@app.get("/towers/bbox")
async def towers_bbox(min_lat: float, max_lat: float, min_lon: float, max_lon: float):
    """Return all towers within a geographic bounding box."""
    if not engine._initialized:
        raise HTTPException(503, "Spatial engine not ready")
    return engine.get_towers_in_bbox(min_lat, max_lat, min_lon, max_lon)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
