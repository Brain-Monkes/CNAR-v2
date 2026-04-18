import asyncio
import sys
import os

# Add the parent directory to Python path if necessary, but we will run from backend dir
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routing import fetch_osrm_routes, downsample_geometry, engine, SEARCH_RADIUS_METERS
from config import TOWER_CSV_PATH
import numpy as np

async def test():
    print("Initializing engine...")
    engine.initialize(TOWER_CSV_PATH, cell_size_m=SEARCH_RADIUS_METERS)
    origin = [77.5855, 12.9715] # Bengaluru center
    destination = [77.6000, 13.0000] 
    print("Fetching OSRM routes...")
    raw_routes = await fetch_osrm_routes(origin, destination)
    
    coords = raw_routes[0]["geometry"]["coordinates"]
    
    latlon_100 = downsample_geometry(coords, 100)
    latlon_500 = downsample_geometry(coords, 500)
    
    c100 = engine.count_towers_along_route(latlon_100, SEARCH_RADIUS_METERS)
    c500 = engine.count_towers_along_route(latlon_500, SEARCH_RADIUS_METERS)
    
    t100_data = engine.get_towers_along_route(latlon_100, SEARCH_RADIUS_METERS)
    t500_data = engine.get_towers_along_route(latlon_500, SEARCH_RADIUS_METERS)
    
    print(f"Count 100 method = {c100}, Towers 100 method = {len(t100_data)}")
    print(f"Count 500 method = {c500}, Towers 500 method = {len(t500_data)}")

import traceback
try:
    asyncio.run(test())
except Exception:
    traceback.print_exc()
