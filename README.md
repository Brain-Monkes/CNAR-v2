# CNAR — Cellular Network-Aware Routing

> Route vehicles not just by time/distance, but by **cellular signal quality along the path**.

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)
![Stack](https://img.shields.io/badge/Frontend-Next.js%2015-000000?style=flat-square)
![Stack](https://img.shields.io/badge/Spatial-Hash%20Grid-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Map-Leaflet-199900?style=flat-square)

CNAR compares a **"Fastest Route"** vs a **"Most Connected Route"** and lets users tune a weighting slider between the two extremes. Built for fleet operators, emergency vehicles, and connected mobility use cases.

---

## 📂 Project Structure

```
CNAR2/
├── backend/
│   ├── config.py                # Constants (search radius, signal weights, API URLs)
│   ├── spatial_engine.py        # Singleton Spatial Hash Engine (O(1) grid lookups)
│   ├── routing.py               # OSRM integration + Pareto scoring engine
│   ├── models.py                # Pydantic request/response schemas
│   ├── main.py                  # FastAPI entrypoint
│   ├── preprocess.py            # One-time script to filter CSV to 4G/5G only
│   ├── requirements.txt         # Python dependencies
│   └── data/
│       └── india-towers.csv     # Raw tower dataset (all radios)
├── frontend/
│   ├── app/
│   │   ├── globals.css          # Design system (dark + light themes)
│   │   ├── layout.tsx           # Root layout with nav
│   │   ├── page.tsx             # Dashboard — map + route planner + telemetry
│   │   ├── routes/page.tsx      # Route comparison sidebar + map
│   │   ├── analytics/page.tsx   # Tower heatmap + stats panel
│   │   └── settings/page.tsx    # Backend URL, radius, route points config
│   ├── components/
│   │   ├── nav/                 # SideNavBar, TopNavBar (with theme toggle)
│   │   ├── map/                 # MapView, RouteLayer, HeatmapLayer, TowerClusterLayer
│   │   └── panels/             # RoutePlanner, RouteCard, TelemetryLog
│   ├── context/                 # RoutingContext (global state + map persistence)
│   ├── lib/                     # API client, signal color helpers
│   └── types/                   # TypeScript interfaces
└── README.md
```

---

## 🚀 Getting Started from Scratch

### Prerequisites

- **Python 3.11+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)

---

### Step 1: Clone the Repository

```bash
git clone <repo-url>
cd CNAR2
```

---

### Step 2: Set Up the Backend

```bash
cd backend
pip install -r requirements.txt
```

---

### Step 3: Preprocess the Tower Data (One-Time)

This strips the raw CSV to only 4G/5G towers, reducing load time and memory:

```bash
python preprocess.py
```

Expected output:
```
Raw dataset: 2,094,156 towers
Done. 412,769 4G/5G towers saved to data/india-towers-4g5g.csv
```

---

### Step 4: Start the Backend Server

```bash
python -m uvicorn main:app --reload --port 8000
```

The backend will:
- Load ~412K 4G/5G towers into a spatial hash grid
- Build O(1) lookup cells (300m cell size)
- Expose API on `http://localhost:8000`

Verify it's running:
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","towers_loaded":true}
```

---

### Step 5: Set Up the Frontend

Open a **new terminal** (keep the backend running):

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at **http://localhost:3000**.

---

### Step 6: Use the Application

1. Open **http://localhost:3000** in your browser
2. On the **Dashboard**:
   - Click the **crosshair (⊕)** next to "Origin", then click on the map
   - Do the same for "Destination"
   - Or type a location name and press Enter to geocode
3. Adjust the **Route Preference** slider:
   - ⚡ Left = Fastest route (pure time)
   - 📶 Right = Most connected route (best signal)
4. Click **"Calculate Routes"** — routes appear with signal-quality gradient coloring
5. Check the **Telemetry Log** (bottom-right) for dead zone alerts
6. Toggle **"Show Tower Clusters"** to see 4G/5G tower markers with auto-clustering
7. Use the ☀️/🌙 button in the top-right to switch between dark and light themes
8. Navigate to:
   - **`/routes`** — compare route cards with towers, dead zones, transitions
   - **`/analytics`** — full tower heatmap + distribution stats
   - **`/settings`** — configure backend URL, search radius, route points

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Spatial Engine** | Spatial Hash Grid (pure Python, O(1) lookups) |
| **Routing** | OSRM public API (router.project-osrm.org) |
| **Geocoding** | OpenStreetMap Nominatim |
| **Frontend** | Next.js 15 (App Router), TypeScript |
| **Styling** | Vanilla CSS (dark + light themes) |
| **Map** | React-Leaflet, Leaflet.heat, react-leaflet-cluster |
| **State** | React Context (RoutingProvider) |
| **Icons** | Lucide React |

---

## 🧮 How It Works

### Spatial Hash Engine
- Tower coordinates `(lat, lon)` → grid cells of 300m × 300m
- `cos(22°)` longitude correction for India's mean latitude
- Query: cell of point → 3×3 neighborhood → haversine on small candidate set
- **O(1) average** vs O(log n) for KD-Tree

### Signal Weights (4G/5G only)
| Radio | Weight | Color |
|---|---|---|
| 5G | 10 | `#4edea3` (emerald) |
| 4G | 7 | `#6e7fff` (indigo) |
| None | 0 | `#ff6b6b` (red) |

### Route Scoring
```
point_score(p)       = max{ weight(tower) : dist(p, tower) ≤ 300m }
connectivity_score   = mean(scores) / 10 × 100%
coverage_pct         = count(score > 0) / total × 100%
```

### Route Ranking (Pareto Composite)
```
Cost = (1 - w) × T_norm + w × (1 - S_norm)
```
Lower cost = better. `w` = user's preference slider.

### Enhanced Metrics
- **Towers in Range** — unique tower count along route
- **Dead Zones** — consecutive segments with zero coverage
- **Signal Transitions** — significant quality change count
- **Telemetry** — auto-generated dead zone enter/exit alerts

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend health check |
| `GET` | `/towers/heatmap` | All tower locations with signal intensity |
| `POST` | `/calculate-routes` | Calculate and score routes |

### POST `/calculate-routes`
```json
{
  "origin": [77.5946, 12.9716],
  "destination": [72.8777, 19.0760],
  "preference_weight": 0.5
}
```
> Coordinates: `[longitude, latitude]` (OSRM convention)

---

## 📊 Dataset

- **Source**: OpenCelliD India subset
- **Raw**: ~2.1M towers (all radio types)
- **After preprocessing**: ~412,769 (4G + 5G only)
- **Columns used**: `radio`, `lat`, `long`

---

## 📄 License

MIT
