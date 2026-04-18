'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { RouteObject, SelectionMode, RoutingState, ThemeMode, TelemetryEntry } from '@/types';
import { api } from '@/lib/api';

interface RoutingContextType extends RoutingState {
  setOrigin: (coords: [number, number], label?: string) => void;
  setDestination: (coords: [number, number], label?: string) => void;
  calculateRoutes: () => Promise<void>;
  selectRoute: (id: string) => void;
  setPreferenceWeight: (w: number) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  fetchHeatmap: () => Promise<void>;
  clearAll: () => void;
  setMapView: (center: [number, number], zoom: number) => void;
  toggleTheme: () => void;
  setShowTowers: (show: boolean) => void;
  addTelemetryEntry: (entry: TelemetryEntry) => void;
  clearTelemetry: () => void;
}

const RoutingContext = createContext<RoutingContextType | null>(null);

export function RoutingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoutingState>({
    origin: null,
    destination: null,
    originLabel: '',
    destinationLabel: '',
    routes: [],
    selectedRouteId: null,
    isLoading: false,
    error: null,
    preferenceWeight: 0.5,
    selectionMode: null,
    heatmapData: [],
    mapCenter: [20.5937, 78.9629],
    mapZoom: 5,
    theme: 'dark',
    showTowers: false,
    telemetryLog: [],
  });

  const setOrigin = useCallback((coords: [number, number], label = '') => {
    setState(s => ({
      ...s,
      origin: coords,
      originLabel: label,
      selectionMode: null,
      // Clear old routes when setting new origin
      routes: [],
      selectedRouteId: null,
      error: null,
      telemetryLog: [],
    }));
  }, []);

  const setDestination = useCallback((coords: [number, number], label = '') => {
    setState(s => ({
      ...s,
      destination: coords,
      destinationLabel: label,
      selectionMode: null,
      // Clear old routes when setting new destination
      routes: [],
      selectedRouteId: null,
      error: null,
      telemetryLog: [],
    }));
  }, []);

  const generateTelemetry = useCallback((routes: RouteObject[]) => {
    const entries: TelemetryEntry[] = [];
    const selectedRoute = routes[0];
    if (!selectedRoute) return entries;

    // Dead zone alerts
    selectedRoute.dead_zones?.forEach((dz, i) => {
      entries.push({
        id: `dz_enter_${i}`,
        type: 'dead_zone_enter',
        message: `⚠️ Vehicle enters dead zone (${dz.length_pct.toFixed(1)}% of route) near [${dz.start_coords[0].toFixed(4)}, ${dz.start_coords[1].toFixed(4)}]`,
        timestamp: new Date().toISOString(),
        coords: dz.start_coords as [number, number],
        severity: 'danger',
      });
      entries.push({
        id: `dz_exit_${i}`,
        type: 'dead_zone_exit',
        message: `✅ Vehicle exits dead zone near [${dz.end_coords[0].toFixed(4)}, ${dz.end_coords[1].toFixed(4)}]`,
        timestamp: new Date().toISOString(),
        coords: dz.end_coords as [number, number],
        severity: 'success',
      });
    });

    // Signal transition alerts
    if (selectedRoute.signal_transitions > 5) {
      entries.push({
        id: 'transitions_warn',
        type: 'signal_change',
        message: `📡 Route has ${selectedRoute.signal_transitions} significant signal transitions — expect connection instability`,
        timestamp: new Date().toISOString(),
        severity: 'warning',
      });
    }

    // Summary
    entries.push({
      id: 'summary',
      type: 'info',
      message: `📊 Route analysis: ${selectedRoute.towers_in_range} towers in range, ${selectedRoute.coverage_pct.toFixed(1)}% coverage, ${selectedRoute.dead_zone_count} dead zones`,
      timestamp: new Date().toISOString(),
      severity: 'info',
    });

    return entries;
  }, []);

  const calculateRoutes = useCallback(async () => {
    if (!state.origin || !state.destination) return;
    setState(s => ({ ...s, isLoading: true, error: null, telemetryLog: [] }));
    try {
      const routes = await api.calculateRoutes(
        state.origin, state.destination, state.preferenceWeight
      );
      const telemetry = generateTelemetry(routes);
      setState(s => ({
        ...s,
        routes,
        selectedRouteId: routes[0]?.id ?? null,
        isLoading: false,
        telemetryLog: telemetry,
      }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState(s => ({ ...s, isLoading: false, error: message }));
    }
  }, [state.origin, state.destination, state.preferenceWeight, generateTelemetry]);

  const selectRoute = useCallback((id: string) => {
    setState(s => ({ ...s, selectedRouteId: id }));
  }, []);

  const setPreferenceWeight = useCallback((w: number) => {
    setState(s => ({ ...s, preferenceWeight: w }));
  }, []);

  const setSelectionMode = useCallback((mode: SelectionMode) => {
    setState(s => ({ ...s, selectionMode: mode }));
  }, []);

  const fetchHeatmap = useCallback(async () => {
    try {
      const data = await api.getHeatmap();
      setState(s => ({ ...s, heatmapData: data }));
    } catch (e: unknown) {
      console.error('Heatmap fetch failed:', e instanceof Error ? e.message : String(e));
    }
  }, []);

  const clearAll = useCallback(() => {
    setState(s => ({
      ...s,
      origin: null, destination: null,
      originLabel: '', destinationLabel: '',
      routes: [], selectedRouteId: null, error: null,
      telemetryLog: [],
    }));
  }, []);

  const setMapView = useCallback((center: [number, number], zoom: number) => {
    setState(s => ({ ...s, mapCenter: center, mapZoom: zoom }));
  }, []);

  const toggleTheme = useCallback(() => {
    setState(s => {
      const newTheme: ThemeMode = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme);
      }
      return { ...s, theme: newTheme };
    });
  }, []);

  const setShowTowers = useCallback((show: boolean) => {
    setState(s => ({ ...s, showTowers: show }));
  }, []);

  const addTelemetryEntry = useCallback((entry: TelemetryEntry) => {
    setState(s => ({ ...s, telemetryLog: [...s.telemetryLog, entry] }));
  }, []);

  const clearTelemetry = useCallback(() => {
    setState(s => ({ ...s, telemetryLog: [] }));
  }, []);

  return (
    <RoutingContext.Provider value={{
      ...state,
      setOrigin, setDestination, calculateRoutes,
      selectRoute, setPreferenceWeight, setSelectionMode,
      fetchHeatmap, clearAll, setMapView, toggleTheme,
      setShowTowers, addTelemetryEntry, clearTelemetry,
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
