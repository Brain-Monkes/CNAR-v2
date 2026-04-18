export interface DeadZone {
  start_idx: number;
  end_idx: number;
  start_coords: [number, number]; // [lat, lon]
  end_coords: [number, number];
  length_pct: number;             // percentage of route
}

export interface RouteObject {
  id: string;
  label: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];  // [lon, lat]
  };
  distance_km: number;
  duration_min: number;
  connectivity_score: number;    // 0-100
  coverage_pct: number;          // 0-100
  point_scores: number[];        // per-point, 0-10
  composite_cost: number;
  is_fastest: boolean;
  is_most_connected: boolean;
  // Enhanced metrics
  towers_in_range: number;       // unique towers along route
  dead_zone_count: number;       // number of dead zone segments
  dead_zone_pct: number;         // % of route in dead zones
  signal_transitions: number;    // signal quality change count
  avg_signal: number;            // raw average signal score
  dead_zones: DeadZone[];        // dead zone details for telemetry
}

export type SelectionMode = 'origin' | 'destination' | null;
export type ThemeMode = 'dark' | 'light';

export interface TelemetryEntry {
  id: string;
  type: 'dead_zone_enter' | 'dead_zone_exit' | 'signal_change' | 'info';
  message: string;
  timestamp: string;
  coords?: [number, number];
  severity: 'warning' | 'danger' | 'info' | 'success';
}

export interface RoutingState {
  origin: [number, number] | null;        // [lat, lon]
  destination: [number, number] | null;
  originLabel: string;
  destinationLabel: string;
  routes: RouteObject[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  preferenceWeight: number;               // 0=fastest, 1=connected
  selectionMode: SelectionMode;
  heatmapData: [number, number, number][];
  // New state
  mapCenter: [number, number];
  mapZoom: number;
  theme: ThemeMode;
  showTowers: boolean;
  telemetryLog: TelemetryEntry[];
}
