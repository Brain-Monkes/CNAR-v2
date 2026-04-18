TOWER_CSV_PATH = "data/india-towers-4g5g.csv"
SEARCH_RADIUS_METERS = 300          # Spatial hash cell size & query radius
EARTH_RADIUS_KM = 6371.0
SIGNAL_WEIGHTS = {"5G": 10, "4G": 7, "3G": 0, "2G": 0}
OSRM_BASE_URL = "http://router.project-osrm.org"
CORS_ORIGINS = ["http://localhost:3000"]
MAX_ROUTE_POINTS = 100              # Downsample if OSRM returns more
