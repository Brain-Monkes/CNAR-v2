export interface DeadZone {
  start_idx: number;
  end_idx: number;
  start_coords: [number, number];
  end_coords: [number, number];
  length_pct: number;
}

export interface RouteObject {
  id: string;
  label: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distance_km: number;
  duration_min: number;
  connectivity_score: number;
  coverage_pct: number;
  point_scores: number[];
  composite_cost: number;
  is_fastest: boolean;
  is_most_connected: boolean;
  towers_in_range: number;
  dead_zone_count: number;
  dead_zone_pct: number;
  signal_transitions: number;
  avg_signal: number;
  dead_zones: DeadZone[];
}

export type SelectionMode = 'origin' | 'destination' | 'waypoint' | null;
export type ThemeMode = 'dark' | 'light';

// Tower data: [lat, lon, intensity, radioIdx, operatorIdx]
export type TowerPoint = [number, number, number, number, number];

export interface TowerFilters {
  radios: Record<string, boolean>;    // { '3G': true, '4G': true, '5G': true }
  operators: Record<string, boolean>; // { 'AirTel': true, 'Jio': true, ... }
}

export interface TelemetryEntry {
  id: string;
  type: 'dead_zone_enter' | 'dead_zone_exit' | 'signal_change' | 'info';
  message: string;
  timestamp: string;
  coords?: [number, number];
  severity: 'warning' | 'danger' | 'info' | 'success';
}

export interface Waypoint {
  coords: [number, number]; // [lat, lon]
  label: string;
}

export interface RoutingState {
  origin: [number, number] | null;
  destination: [number, number] | null;
  originLabel: string;
  destinationLabel: string;
  waypoints: Waypoint[];
  routes: RouteObject[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  preferenceWeight: number;
  selectionMode: SelectionMode;
  // Tower data (structured with radio/operator info)
  towerData: TowerPoint[];
  radioTypes: string[];
  operatorList: string[];
  towerFilters: TowerFilters;
  // Map & UI
  mapCenter: [number, number];
  mapZoom: number;
  theme: ThemeMode;
  showTowers: boolean;
  telemetryLog: TelemetryEntry[];
}
