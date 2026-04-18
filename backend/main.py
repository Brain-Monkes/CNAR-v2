from fastapi import FastAPI, HTTPException
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


app = FastAPI(title="CNAR Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "towers_loaded": engine._initialized}


@app.get("/towers/heatmap")
async def towers_heatmap():
    if not engine._initialized:
        raise HTTPException(503, "Spatial engine not ready")
    data = engine.get_heatmap_data()
    return {"towers": data, "count": len(data)}


@app.post("/calculate-routes")
async def route_endpoint(req: RouteRequest):
    try:
        routes = await calculate_routes(
            req.origin, req.destination, req.preference_weight
        )
        return {"routes": routes, "count": len(routes)}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Routing failed: {str(e)}")
