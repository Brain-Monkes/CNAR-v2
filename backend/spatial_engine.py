"""
SpatialHashEngine — O(1) fixed-radius tower lookup using geographic grid hashing.

Design:
  - Cell size = search radius (e.g. 300m)
  - Convert (lat, lon) -> (cell_x, cell_y) using meters-per-degree approximation
  - Store towers in a dict keyed by (cell_x, cell_y)
  - Query: compute cell of query point, check 3x3 neighborhood
  - Haversine used ONLY for final distance check on the small candidate set
"""

import numpy as np
import pandas as pd
from collections import defaultdict
from typing import List, Dict, Tuple, Set
import threading
import math


class SpatialHashEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
        return cls._instance

    def initialize(self, csv_path: str, cell_size_m: float = 300.0):
        if self._initialized:
            return

        self.cell_size_m = cell_size_m
        self.DEG_PER_METER_LAT = 1.0 / 111_320.0
        self.DEG_PER_METER_LON = 1.0 / (111_320.0 * math.cos(math.radians(22.0)))
        self.cell_deg_lat = cell_size_m * self.DEG_PER_METER_LAT
        self.cell_deg_lon = cell_size_m * self.DEG_PER_METER_LON

        df = pd.read_csv(csv_path)
        df = df[df['radio'].isin(['4G', '5G'])].dropna(subset=['lat', 'long'])
        df = df.rename(columns={'long': 'lon'})

        self.lats = df['lat'].values
        self.lons = df['lon'].values
        self.radios = df['radio'].values

        self.grid: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        for i in range(len(self.lats)):
            cell = self._cell(self.lats[i], self.lons[i])
            self.grid[cell].append(i)

        self._initialized = True
        print(f"[SpatialHashEngine] {len(self.lats)} towers in {len(self.grid)} cells "
              f"(cell_size={cell_size_m}m)")

    def _cell(self, lat: float, lon: float) -> Tuple[int, int]:
        return (
            int(math.floor(lat / self.cell_deg_lat)),
            int(math.floor(lon / self.cell_deg_lon)),
        )

    def _haversine_m(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6_371_000.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))

    def query_best_signal(self, lat: float, lon: float, radius_m: float, signal_weights: dict) -> float:
        cx, cy = self._cell(lat, lon)
        best_score = 0.0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in self.grid.get((cx + dx, cy + dy), []):
                    if self._haversine_m(lat, lon, self.lats[i], self.lons[i]) <= radius_m:
                        score = signal_weights.get(self.radios[i], 0)
                        if score > best_score:
                            best_score = score
                            if best_score == 10:
                                return 10.0
        return best_score

    def query_batch(self, latlon_points: np.ndarray, radius_m: float, signal_weights: dict) -> np.ndarray:
        scores = np.zeros(len(latlon_points))
        for i, (lat, lon) in enumerate(latlon_points):
            scores[i] = self.query_best_signal(lat, lon, radius_m, signal_weights)
        return scores

    def count_towers_along_route(self, latlon_points: np.ndarray, radius_m: float) -> int:
        """Count unique towers within radius of any route point."""
        tower_set: Set[int] = set()
        for lat, lon in latlon_points:
            cx, cy = self._cell(lat, lon)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for i in self.grid.get((cx + dx, cy + dy), []):
                        if self._haversine_m(lat, lon, self.lats[i], self.lons[i]) <= radius_m:
                            tower_set.add(i)
        return len(tower_set)

    def get_heatmap_data(self) -> List[List[float]]:
        """Returns ALL towers as [lat, lon, intensity] triples for leaflet.heat."""
        from config import SIGNAL_WEIGHTS
        max_w = max(SIGNAL_WEIGHTS.values())
        result = []
        for i in range(len(self.lats)):
            intensity = SIGNAL_WEIGHTS.get(self.radios[i], 0) / max_w
            result.append([float(self.lats[i]), float(self.lons[i]), float(intensity)])
        return result
