/**
 * Multi-color heatmap layer — renders separate leaflet.heat layers
 * per radio type or per operator, each with its own color.
 */
'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { TowerPoint } from '@/types';

export type HeatmapColorMode = 'default' | 'radio' | 'operator';

interface Props {
  data: TowerPoint[];        // [lat, lon, intensity, radioIdx, operatorIdx]
  radioTypes: string[];
  operatorList: string[];
  mode: HeatmapColorMode;
}

const RADIO_GRADIENTS: Record<string, Record<number, string>> = {
  '3G': { 0.0: 'rgba(255,145,0,0)', 0.4: '#ff9100', 0.7: '#ffab40', 1.0: '#ffd180' },
  '4G': { 0.0: 'rgba(68,138,255,0)', 0.4: '#448aff', 0.7: '#82b1ff', 1.0: '#bbdefb' },
  '5G': { 0.0: 'rgba(0,230,118,0)', 0.4: '#00e676', 0.7: '#69f0ae', 1.0: '#b9f6ca' },
};

const OPERATOR_GRADIENTS: Record<string, Record<number, string>> = {
  'AirTel':             { 0.0: 'rgba(255,82,82,0)', 0.4: '#ff5252', 0.7: '#ff8a80', 1.0: '#ffcdd2' },
  'Vi (Vodafone Idea)': { 0.0: 'rgba(224,64,251,0)', 0.4: '#e040fb', 0.7: '#ea80fc', 1.0: '#f3e5f5' },
  'Jio':                { 0.0: 'rgba(68,138,255,0)', 0.4: '#448aff', 0.7: '#82b1ff', 1.0: '#bbdefb' },
  'BSNL':               { 0.0: 'rgba(255,215,64,0)', 0.4: '#ffd740', 0.7: '#ffe57f', 1.0: '#fff9c4' },
};

const DEFAULT_GRADIENT = {
  0.0: '#1a0533',
  0.3: '#6a1b9a',
  0.5: '#00bcd4',
  0.7: '#80deea',
  1.0: '#e0f7fa',
};

export function ColoredHeatmapLayer({ data, radioTypes, operatorList, mode }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!data.length) return;

    const layers: L.Layer[] = [];

    if (mode === 'radio') {
      // Split towers by radio type, one layer per radio
      const buckets: Record<string, [number, number, number][]> = {};
      radioTypes.forEach(r => { buckets[r] = []; });
      for (const [lat, lon, intensity, rIdx] of data) {
        const radioName = radioTypes[rIdx];
        if (radioName && buckets[radioName]) {
          buckets[radioName].push([lat, lon, intensity]);
        }
      }
      for (const [radio, points] of Object.entries(buckets)) {
        if (points.length === 0) continue;
        const gradient = RADIO_GRADIENTS[radio] || DEFAULT_GRADIENT;
        // @ts-expect-error — leaflet.heat augments L
        const layer = L.heatLayer(points, {
          radius: 18, blur: 22, maxZoom: 14, gradient,
        }).addTo(map);
        layers.push(layer);
      }
    } else if (mode === 'operator') {
      // Split towers by operator, one layer per operator
      const buckets: Record<string, [number, number, number][]> = {};
      operatorList.forEach(o => { buckets[o] = []; });
      for (const [lat, lon, intensity, , oIdx] of data) {
        const opName = operatorList[oIdx];
        if (opName && buckets[opName]) {
          buckets[opName].push([lat, lon, intensity]);
        }
      }
      for (const [op, points] of Object.entries(buckets)) {
        if (points.length === 0) continue;
        const gradient = OPERATOR_GRADIENTS[op] || DEFAULT_GRADIENT;
        // @ts-expect-error — leaflet.heat augments L
        const layer = L.heatLayer(points, {
          radius: 18, blur: 22, maxZoom: 14, gradient,
        }).addTo(map);
        layers.push(layer);
      }
    } else {
      // Default: single combined heatmap
      const points: [number, number, number][] = data.map(([lat, lon, intensity]) => [lat, lon, intensity]);
      // @ts-expect-error — leaflet.heat augments L
      const layer = L.heatLayer(points, {
        radius: 20, blur: 25, maxZoom: 14, gradient: DEFAULT_GRADIENT,
      }).addTo(map);
      layers.push(layer);
    }

    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [data, radioTypes, operatorList, mode, map]);

  return null;
}
