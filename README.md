---
title: CNAR Cellular Network Routing
emoji: 🛰️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# CNAR — Cellular Network-Aware Routing

> Route vehicles not just by time/distance, but by **cellular signal quality along the path**.

[![Live App](https://img.shields.io/badge/Live%20Demo-Hugging%20Face%20Spaces-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/spaces/samitkoya/CNAR)

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)
![Stack](https://img.shields.io/badge/Frontend-Next.js%2016-000000?style=flat-square)
![Stack](https://img.shields.io/badge/Spatial-Hash%20Grid-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Map-Leaflet-199900?style=flat-square)
![Stack](https://img.shields.io/badge/Hosting-Hugging%20Face_Spaces-FFD21E?style=flat-square)

CNAR compares a **"Fastest Route"** vs a **"Most Connected Route"** and lets users tune a weighting slider between the two extremes. Built for autonomous vehicles, fleet operators, emergency services, and continuously connected mobility use cases.

**[Visit Live Demo on Hugging Face Spaces](https://huggingface.co/spaces/samitkoya/CNAR)**

---

## Key Features

- **Dynamic Pareto Routing**: Multi-objective routing weighing traversal time against network dead zones.
- **Telecom Operator Analytics**: Filter routes and signal availability by specific telecom operators (Jio, Airtel, Vi, BSNL).
- **50-Meter Corridor Tracking**: High-fidelity spatial tracking calculates actual active towers strictly adhering to a 50-meter radius of the physical route trajectory.
- **Asynchronous Threaded Engine**: Mathematical Haversine calculations are automatically spun into high-performance Thread pools, allowing the FastAPI server to process massive throughput dynamically.
- **Containerized Delivery**: The React interface is statically built in `out/` and seamlessly delivered by the FastAPI Python server inside a single portable Docker Container.
- **Ultra-Lite Dataset Handling**: The heavy ~140MB OpenCelliD India tower dataset is effectively compressed to a 7.8MB Gzip (`.csv.gz`) allowing native Pandas decompression without heavy memory penalties.

---

## Project Architecture

```
CNAR2/
├── backend/
│   ├── config.py                # System Constants & Signal Weights
│   ├── spatial_engine.py        # O(1) Spatial Hash Engine for geographic lookups
│   ├── routing.py               # Pareto optimization and asyncio Threading
│   ├── models.py                # Pydantic schemas (Radio + Operator filters)
│   ├── main.py                  # FastAPI + Next.js Static File Mounter
│   ├── preprocess.py            # Dataset stripper (2G removal)
│   ├── stress_test.py           # Backend load and throughput simulator
│   └── data/
│       └── india-towers-processed.csv.gz # Live compressed dataset (4G/5G)
├── frontend/
│   ├── app/                     # Page Routing (Dashboard, Routes, Analytics, Settings)
│   ├── components/              # Leaflet Heatmaps, Navigation, UI Elements
│   ├── context/                 # Global Routing Context Managers
│   ├── lib/                     # API connections (Dynamic origin detection)
│   └── next.config.ts           # Configuration for Static Export Builder
├── Dockerfile                   # HF Space Multi-stage Docker config
├── .dockerignore                # Optimizations for Context builds
└── README.md                    # Documentation
```

---

## Easy Deployment (Hugging Face Spaces)

This project is tailored to deploy identically as a Docker Space on Hugging Face.

1. **Create Space**: Choose **Docker** as your Space SDK template.
2. **Push the Code**: Add the space as a git remote and push your code.
   ```bash
   git lfs track "*.csv.gz"
   git add .
   git commit -m "Deploy"
   git push HF_URL main
   ```
3. **Build**: Hugging Face automatically detects the `Dockerfile`, triggers `npm run build` on the Next.js frontend, imports the static UI, boots up the Python backend, and natively serves your platform on port `7860`.

---

## Local Setup from Scratch

### Prerequisites
- **Python 3.11+** 
- **Node.js 18+**

### Step 1: Set Up the Environment
```bash
git clone <repo-url>
cd CNAR2
```

### Step 2: Build the Frontend (Export)
```bash
cd frontend
npm install
npm run build 
```
*(This generates the `out/` static folder for the backend to mount).*

### Step 3: Start the Full-Stack Backend
```bash
cd ../backend
pip install -r requirements.txt

# Start the server with multiple workers for maximum Thread pool concurrency
python -m uvicorn main:app --port 8000 --workers 4
```

Navigate your browser to `http://localhost:8000` to interact with the full CNAR Dashboard!

---

## How the Engine Works

### Spatial Hash Engine
- Tower coordinates `(lat, lon)` → grid cells of 300m × 300m
- Query: cell of point → 3×3 neighborhood → haversine on small candidate set
- **O(1) average** vs O(log n) for standard KD-Tree setups.

### Signal Weights (4G/5G)
| Radio | Weight | Color |
|---|---|---|
| 5G | 10 | `#4edea3` (emerald) |
| 4G | 7 | `#6e7fff` (indigo) |
| None | 0 | `#ff6b6b` (red) |

### Route Ranking (Pareto Composite)
```
Cost = (1 - w) × T_norm + w × (1 - S_norm)
```
Lower cost = better. `w` = user's preference slider.

### Network Filters
Through the UI, routes can be requested using selected Cellular operators (Jio, Airtel, Vodafone Idea, BSNL). High-frequency nodes filter the database before processing the grid, offering provider-specific coverage routing.

---

## Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend readiness validation |
| `GET` | `/towers/heatmap` | Full country-wide heatmap projection data |
| `POST` | `/calculate-routes` | Main Threaded scoring operator (supports multiple waypoints) |

---

## License
MIT
