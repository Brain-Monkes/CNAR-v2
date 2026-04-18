'use client';
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { RouteObject, SelectionMode, RoutingState, ThemeMode, TelemetryEntry, TowerPoint, TowerFilters, FullStats, CrossStats, Waypoint } from '@/types';
import { api } from '@/lib/api';

interface RoutingContextType extends RoutingState {
  setOrigin: (coords: [number, number], label?: string) => void;
  setDestination: (coords: [number, number], label?: string) => void;
  addWaypoint: (coords: [number, number], label?: string) => void;
  removeWaypoint: (index: number) => void;
  calculateRoutes: () => Promise<void>;
  selectRoute: (id: string) => void;
  setPreferenceWeight: (w: number) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  fetchHeatmap: (limit?: number) => Promise<void>;
  clearAll: () => void;
  setMapView: (center: [number, number], zoom: number) => void;
  toggleTheme: () => void;
  setShowTowers: (show: boolean) => void;
  setTowerFilters: (filters: TowerFilters) => void;
  filteredTowerData: TowerPoint[];
  filteredHeatmap: [number, number, number][];
  selectedRoute: RouteObject | null;
  telemetryForRoute: (route: RouteObject) => TelemetryEntry[];
}

const RoutingContext = createContext<RoutingContextType | null>(null);

function generateTelemetry(route: RouteObject): TelemetryEntry[] {
  const entries: TelemetryEntry[] = [];
  route.dead_zones?.forEach((dz, i) => {
    entries.push({ id: `dz_enter_${i}`, type: 'dead_zone_enter', message: `⚠️ Dead zone entry (${dz.length_pct.toFixed(1)}% of route) at [${dz.start_coords[0].toFixed(4)}, ${dz.start_coords[1].toFixed(4)}]`, timestamp: new Date().toISOString(), coords: dz.start_coords as [number, number], severity: 'danger' });
    entries.push({ id: `dz_exit_${i}`, type: 'dead_zone_exit', message: `✅ Dead zone exit at [${dz.end_coords[0].toFixed(4)}, ${dz.end_coords[1].toFixed(4)}]`, timestamp: new Date().toISOString(), coords: dz.end_coords as [number, number], severity: 'success' });
  });
  if (route.signal_transitions > 5) {
    entries.push({ id: 'trans', type: 'signal_change', message: `📡 ${route.signal_transitions} significant signal transitions — expect instability`, timestamp: new Date().toISOString(), severity: 'warning' });
  }
  entries.push({ id: 'summary', type: 'info', message: `📊 ${route.towers_in_range} towers, ${route.coverage_pct.toFixed(1)}% coverage, ${route.dead_zone_count} dead zones`, timestamp: new Date().toISOString(), severity: 'info' });
  return entries;
}

/**
 * Compute bounding box of all route geometries with a padding in degrees.
 * OSRM geometry is [lon, lat], so we flip to [lat, lon] for the bbox.
 */
function computeRoutesBBox(routes: RouteObject[], padDeg = 0.05): {
  minLat: number; maxLat: number; minLon: number; maxLon: number;
} | null {
  if (routes.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const route of routes) {
    for (const [lon, lat] of route.geometry.coordinates) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return {
    minLat: minLat - padDeg, maxLat: maxLat + padDeg,
    minLon: minLon - padDeg, maxLon: maxLon + padDeg,
  };
}

export function RoutingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoutingState>({
    origin: null, destination: null, originLabel: '', destinationLabel: '',
    waypoints: [], routes: [], selectedRouteId: null,
    isLoading: false, error: null, preferenceWeight: 0.5, selectionMode: null,
    towerData: [], totalTowers: 0, radioTypes: [], operatorList: [],
    towerFilters: { radios: {}, operators: {} },
    fullStats: { byRadio: {}, byOperator: {} },
    crossStats: {},
    routeTowers: [],
    mapCenter: [20.5937, 78.9629], mapZoom: 5,
    theme: 'dark', showTowers: true, telemetryLog: [],
  });

  const setOrigin = useCallback((coords: [number, number], label = '') => {
    setState(s => ({ ...s, origin: coords, originLabel: label, selectionMode: null, routes: [], selectedRouteId: null, error: null, telemetryLog: [], routeTowers: [] }));
  }, []);

  const setDestination = useCallback((coords: [number, number], label = '') => {
    setState(s => ({ ...s, destination: coords, destinationLabel: label, selectionMode: null, routes: [], selectedRouteId: null, error: null, telemetryLog: [], routeTowers: [] }));
  }, []);

  const addWaypoint = useCallback((coords: [number, number], label = '') => {
    setState(s => ({ ...s, waypoints: [...s.waypoints, { coords, label }], selectionMode: null, routes: [], selectedRouteId: null, routeTowers: [] }));
  }, []);

  const removeWaypoint = useCallback((index: number) => {
    setState(s => ({ ...s, waypoints: s.waypoints.filter((_, i) => i !== index), routes: [], selectedRouteId: null, routeTowers: [] }));
  }, []);

  const calculateRoutes = useCallback(async () => {
    if (!state.origin || !state.destination) return;
    setState(s => ({ ...s, isLoading: true, error: null, telemetryLog: [], routeTowers: [] }));
    try {
      // Build active filter lists from context
      const activeRadios = Object.entries(state.towerFilters.radios)
        .filter(([, v]) => v).map(([k]) => k);
      const activeOperators = Object.entries(state.towerFilters.operators)
        .filter(([, v]) => v).map(([k]) => k);

      const wpCoords = state.waypoints.map(w => w.coords);
      const routes = await api.calculateRoutes(
        state.origin, state.destination, state.preferenceWeight,
        wpCoords.length > 0 ? wpCoords : undefined,
        activeRadios.length > 0 ? activeRadios : undefined,
        activeOperators.length > 0 ? activeOperators : undefined,
      );
      setState(s => ({ ...s, routes, selectedRouteId: routes[0]?.id ?? null, isLoading: false }));

      // Auto-fetch towers along all route corridors
      const bbox = computeRoutesBBox(routes);
      if (bbox) {
        try {
          const data = await api.getTowersBBox(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon);
          setState(s => ({ ...s, routeTowers: data.towers }));
        } catch (e) {
          console.error('Failed to fetch route towers:', e);
        }
      }
    } catch (e: unknown) {
      setState(s => ({ ...s, isLoading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [state.origin, state.destination, state.preferenceWeight, state.waypoints, state.towerFilters]);

  const selectRoute = useCallback((id: string) => setState(s => ({ ...s, selectedRouteId: id })), []);
  const setPreferenceWeight = useCallback((w: number) => setState(s => ({ ...s, preferenceWeight: w })), []);
  const setSelectionMode = useCallback((mode: SelectionMode) => setState(s => ({ ...s, selectionMode: mode })), []);

  const fetchHeatmap = useCallback(async (limit?: number) => {
    try {
      const data = await api.getHeatmap(limit);
      const radios: Record<string, boolean> = {};
      data.radioTypes.forEach(r => { radios[r] = true; });
      const operators: Record<string, boolean> = {};
      data.operators.forEach(o => { operators[o] = true; });
      setState(s => ({
        ...s, towerData: data.towers, totalTowers: data.totalTowers,
        radioTypes: data.radioTypes, operatorList: data.operators,
        towerFilters: { radios, operators },
        fullStats: data.fullStats,
        crossStats: data.crossStats,
      }));
    } catch (e: unknown) { console.error('Heatmap fetch failed:', e); }
  }, []);

  const clearAll = useCallback(() => {
    setState(s => ({ ...s, origin: null, destination: null, originLabel: '', destinationLabel: '', waypoints: [], routes: [], selectedRouteId: null, error: null, telemetryLog: [], routeTowers: [] }));
  }, []);

  const setMapView = useCallback((center: [number, number], zoom: number) => setState(s => ({ ...s, mapCenter: center, mapZoom: zoom })), []);

  const toggleTheme = useCallback(() => {
    setState(s => {
      const t: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
      return { ...s, theme: t };
    });
  }, []);

  const setShowTowers = useCallback((show: boolean) => setState(s => ({ ...s, showTowers: show })), []);
  const setTowerFilters = useCallback((filters: TowerFilters) => setState(s => ({ ...s, towerFilters: filters })), []);

  const filteredTowerData = useMemo(() =>
    state.towerData.filter(([, , , rIdx, oIdx]) => {
      const radio = state.radioTypes[rIdx];
      const operator = state.operatorList[oIdx];
      return (state.towerFilters.radios[radio] ?? true) && (state.towerFilters.operators[operator] ?? true);
    }), [state.towerData, state.radioTypes, state.operatorList, state.towerFilters]);

  const filteredHeatmap: [number, number, number][] = useMemo(() =>
    filteredTowerData.map(([lat, lon, intensity]) => [lat, lon, intensity]),
    [filteredTowerData]);

  const selectedRoute = useMemo(() =>
    state.routes.find(r => r.id === state.selectedRouteId) ?? null,
    [state.routes, state.selectedRouteId]);

  const telemetryForRoute = useCallback((route: RouteObject) => generateTelemetry(route), []);

  return (
    <RoutingContext.Provider value={{
      ...state, setOrigin, setDestination, addWaypoint, removeWaypoint,
      calculateRoutes, selectRoute, setPreferenceWeight, setSelectionMode,
      fetchHeatmap, clearAll, setMapView, toggleTheme,
      setShowTowers, setTowerFilters, filteredTowerData, filteredHeatmap,
      selectedRoute, telemetryForRoute,
    }}>
      {children}
    </RoutingContext.Provider>
  );
}

export function useRouting(): RoutingContextType {
  const ctx = useContext(RoutingContext);
  if (!ctx) throw new Error('useRouting must be inside RoutingProvider');
  return ctx;
}
