"""
SpatialHashEngine — O(1) fixed-radius tower lookup with radio/operator filtering.
"""

import numpy as np
import pandas as pd
from collections import defaultdict
from typing import List, Dict, Tuple, Set, Optional
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
        df = df[df['radio'].isin(['3G', '4G', '5G'])].dropna(subset=['lat', 'long'])
        df = df.rename(columns={'long': 'lon'})
        df['operator'] = df['operator'].fillna('Unknown')
        # Shuffle so any sampling/slicing gives uniform geographic coverage
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)

        self.lats = df['lat'].values
        self.lons = df['lon'].values
        self.radios = df['radio'].values
        self.operators = df['operator'].values
        self.unique_operators = sorted(df['operator'].unique().tolist())

        self.grid: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        for i in range(len(self.lats)):
            cell = self._cell(self.lats[i], self.lons[i])
            self.grid[cell].append(i)

        self._initialized = True
        print(f"[SpatialHashEngine] {len(self.lats)} towers in {len(self.grid)} cells "
              f"(cell_size={cell_size_m}m, operators={self.unique_operators})")

    def _cell(self, lat: float, lon: float) -> Tuple[int, int]:
        return (int(math.floor(lat / self.cell_deg_lat)), int(math.floor(lon / self.cell_deg_lon)))

    def _haversine_m(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6_371_000.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))

    def _is_tower_active(self, idx: int,
                         active_radios: Optional[Set[str]],
                         active_operators: Optional[Set[str]]) -> bool:
        """Check if a tower passes the active filters."""
        if active_radios and self.radios[idx] not in active_radios:
            return False
        if active_operators and self.operators[idx] not in active_operators:
            return False
        return True

    def query_best_signal(self, lat: float, lon: float, radius_m: float,
                          signal_weights: dict,
                          active_radios: Optional[Set[str]] = None,
                          active_operators: Optional[Set[str]] = None) -> float:
        cx, cy = self._cell(lat, lon)
        best_score = 0.0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in self.grid.get((cx + dx, cy + dy), []):
                    if not self._is_tower_active(i, active_radios, active_operators):
                        continue
                    if self._haversine_m(lat, lon, self.lats[i], self.lons[i]) <= radius_m:
                        score = signal_weights.get(self.radios[i], 0)
                        if score > best_score:
                            best_score = score
                            if best_score == 10:
                                return 10.0
        return best_score

    def query_batch(self, latlon_points: np.ndarray, radius_m: float,
                    signal_weights: dict,
                    active_radios: Optional[Set[str]] = None,
                    active_operators: Optional[Set[str]] = None) -> np.ndarray:
        scores = np.zeros(len(latlon_points))
        for i, (lat, lon) in enumerate(latlon_points):
            scores[i] = self.query_best_signal(lat, lon, radius_m, signal_weights,
                                               active_radios, active_operators)
        return scores

    def count_towers_along_route(self, latlon_points: np.ndarray, radius_m: float,
                                 active_radios: Optional[Set[str]] = None,
                                 active_operators: Optional[Set[str]] = None) -> int:
        tower_set: Set[int] = set()
        for lat, lon in latlon_points:
            cx, cy = self._cell(lat, lon)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for i in self.grid.get((cx + dx, cy + dy), []):
                        if not self._is_tower_active(i, active_radios, active_operators):
                            continue
                        if self._haversine_m(lat, lon, self.lats[i], self.lons[i]) <= radius_m:
                            tower_set.add(i)
        return len(tower_set)

    def get_towers_along_route(self, latlon_points: np.ndarray, radius_m: float,
                               active_radios: Optional[Set[str]] = None,
                               active_operators: Optional[Set[str]] = None) -> list:
        """Return actual tower data for all towers within radius_m of route points."""
        from config import SIGNAL_WEIGHTS
        max_w = max(SIGNAL_WEIGHTS.values())
        radio_list = ['3G', '4G', '5G']
        radio_to_idx = {r: idx for idx, r in enumerate(radio_list)}
        op_to_idx = {op: idx for idx, op in enumerate(self.unique_operators)}

        tower_set: Set[int] = set()
        for lat, lon in latlon_points:
            cx, cy = self._cell(lat, lon)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for i in self.grid.get((cx + dx, cy + dy), []):
                        if i in tower_set:
                            continue
                        if not self._is_tower_active(i, active_radios, active_operators):
                            continue
                        if self._haversine_m(lat, lon, self.lats[i], self.lons[i]) <= radius_m:
                            tower_set.add(i)

        towers = []
        for i in tower_set:
            intensity = SIGNAL_WEIGHTS.get(self.radios[i], 0) / max_w
            towers.append([float(self.lats[i]), float(self.lons[i]), float(intensity),
                           radio_to_idx.get(self.radios[i], 0),
                           op_to_idx.get(self.operators[i], 0)])
        return towers

    def get_heatmap_data(self, max_towers: int = 50000) -> dict:
        """Return tower data for frontend visualization.
        Stats are always computed from the FULL dataset.
        Tower array is uniformly sampled if max_towers > 0; set max_towers=0 for all.
        """
        from config import SIGNAL_WEIGHTS
        max_w = max(SIGNAL_WEIGHTS.values())
        op_list = self.unique_operators
        op_to_idx = {op: idx for idx, op in enumerate(op_list)}
        radio_list = ['3G', '4G', '5G']
        radio_to_idx = {r: idx for idx, r in enumerate(radio_list)}

        total = len(self.lats)

        # --- Full-dataset stats (always from ALL towers) ---
        by_radio = {r: 0 for r in radio_list}
        by_operator = {op: 0 for op in op_list}
        # Cross-tabulation: radio × operator → count (from ALL towers)
        cross = {r: {op: 0 for op in op_list} for r in radio_list}
        for i in range(total):
            r = self.radios[i]
            op = self.operators[i]
            if r in by_radio:
                by_radio[r] += 1
            if op in by_operator:
                by_operator[op] += 1
            if r in cross and op in cross[r]:
                cross[r][op] += 1

        # --- Determine which tower indices to return ---
        if max_towers <= 0 or total <= max_towers:
            indices = range(total)
        else:
            step = max(1, total // max_towers)
            indices = range(0, total, step)

        towers = []
        for i in indices:
            intensity = SIGNAL_WEIGHTS.get(self.radios[i], 0) / max_w
            towers.append([float(self.lats[i]), float(self.lons[i]), float(intensity),
                           radio_to_idx.get(self.radios[i], 0),
                           op_to_idx.get(self.operators[i], 0)])
        return {
            "towers": towers, "radio_types": radio_list,
            "operators": op_list, "count": len(towers), "total": total,
            "stats": {"by_radio": by_radio, "by_operator": by_operator},
            "cross_stats": cross,
        }

    def get_towers_in_bbox(self, min_lat: float, max_lat: float,
                           min_lon: float, max_lon: float) -> dict:
        """Return ALL towers within a geographic bounding box.
        Uses spatial hash grid cells to avoid scanning the entire dataset.
        """
        from config import SIGNAL_WEIGHTS
        max_w = max(SIGNAL_WEIGHTS.values())
        radio_list = ['3G', '4G', '5G']
        radio_to_idx = {r: idx for idx, r in enumerate(radio_list)}
        op_list = self.unique_operators
        op_to_idx = {op: idx for idx, op in enumerate(op_list)}

        # Determine which grid cells overlap with the bounding box
        cell_min_lat = int(math.floor(min_lat / self.cell_deg_lat))
        cell_max_lat = int(math.floor(max_lat / self.cell_deg_lat))
        cell_min_lon = int(math.floor(min_lon / self.cell_deg_lon))
        cell_max_lon = int(math.floor(max_lon / self.cell_deg_lon))

        seen: Set[int] = set()
        towers = []
        for cx in range(cell_min_lat, cell_max_lat + 1):
            for cy in range(cell_min_lon, cell_max_lon + 1):
                for i in self.grid.get((cx, cy), []):
                    if i in seen:
                        continue
                    lat_i = self.lats[i]
                    lon_i = self.lons[i]
                    if min_lat <= lat_i <= max_lat and min_lon <= lon_i <= max_lon:
                        seen.add(i)
                        intensity = SIGNAL_WEIGHTS.get(self.radios[i], 0) / max_w
                        towers.append([float(lat_i), float(lon_i), float(intensity),
                                       radio_to_idx.get(self.radios[i], 0),
                                       op_to_idx.get(self.operators[i], 0)])

        return {
            "towers": towers, "radio_types": radio_list,
            "operators": op_list, "count": len(towers),
        }

