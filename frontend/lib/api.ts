import { RouteObject, TowerPoint } from '@/types';

const API_BASE = 'http://localhost:8000';

export const api = {
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'ok' && data.towers_loaded;
    } catch { return false; }
  },

  async getHeatmap(limit?: number): Promise<{
    towers: TowerPoint[];
    radioTypes: string[];
    operators: string[];
    totalTowers: number;
    fullStats: { byRadio: Record<string, number>; byOperator: Record<string, number> };
    crossStats: Record<string, Record<string, number>>;
  }> {
    const url = limit !== undefined
      ? `${API_BASE}/towers/heatmap?limit=${limit}`
      : `${API_BASE}/towers/heatmap`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      towers: data.towers,
      radioTypes: data.radio_types,
      operators: data.operators,
      totalTowers: data.total ?? data.count,
      fullStats: {
        byRadio: data.stats?.by_radio ?? {},
        byOperator: data.stats?.by_operator ?? {},
      },
      crossStats: data.cross_stats ?? {},
    };
  },

  async calculateRoutes(
    origin: [number, number],
    destination: [number, number],
    weight: number,
    waypoints?: [number, number][],
    activeRadios?: string[],
    activeOperators?: string[],
  ): Promise<{ routes: RouteObject[]; routeTowers: TowerPoint[] }> {
    const body: Record<string, unknown> = {
      origin: [origin[1], origin[0]],
      destination: [destination[1], destination[0]],
      preference_weight: weight,
    };
    if (waypoints && waypoints.length > 0) {
      body.waypoints = waypoints.map(([lat, lon]) => [lon, lat]);
    }
    if (activeRadios) body.active_radios = activeRadios;
    if (activeOperators) body.active_operators = activeOperators;

    const res = await fetch(`${API_BASE}/calculate-routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { routes: data.routes, routeTowers: data.route_towers ?? [] };
  },

  async getTowersBBox(minLat: number, maxLat: number, minLon: number, maxLon: number): Promise<{
    towers: TowerPoint[]; radioTypes: string[]; operators: string[]; count: number;
  }> {
    const url = `${API_BASE}/towers/bbox?min_lat=${minLat}&max_lat=${maxLat}&min_lon=${minLon}&max_lon=${maxLon}`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      towers: data.towers,
      radioTypes: data.radio_types,
      operators: data.operators,
      count: data.count,
    };
  },

  async geocode(query: string): Promise<{ lat: number; lon: number; label: string } | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
  },

  async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch { return `${lat.toFixed(4)}, ${lon.toFixed(4)}`; }
  },
};
