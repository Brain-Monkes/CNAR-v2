import type { RouteObject } from '@/types';

const getBase = (): string =>
  (typeof window !== 'undefined' && localStorage.getItem('cnar_backend_url'))
  || 'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${getBase()}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  async calculateRoutes(
    origin: [number, number],       // [lat, lon]
    destination: [number, number],  // [lat, lon]
    preferenceWeight: number
  ): Promise<RouteObject[]> {
    // OSRM expects [lon, lat] — swap here, not in components
    const data = await post<{ routes: RouteObject[] }>('/calculate-routes', {
      origin: [origin[1], origin[0]],
      destination: [destination[1], destination[0]],
      preference_weight: preferenceWeight,
    });
    return data.routes;
  },

  async getHeatmap(): Promise<[number, number, number][]> {
    const data = await get<{ towers: [number, number, number][] }>('/towers/heatmap');
    return data.towers;
  },

  async healthCheck(): Promise<boolean> {
    try {
      await get('/health');
      return true;
    } catch {
      return false;
    }
  },

  async geocode(query: string): Promise<{ lat: number; lon: number; label: string } | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      label: data[0].display_name,
    };
  },

  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  },
};
