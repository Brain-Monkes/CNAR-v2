/**
 * Wraps the leaflet.heat plugin for use inside React-Leaflet.
 * leaflet.heat expects: L.heatLayer([[lat, lon, intensity], ...], options)
 */
'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface Props {
  data: [number, number, number][];  // [lat, lon, intensity]
}

export function HeatmapLayer({ data }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!data.length) return;
    // @ts-expect-error — leaflet.heat augments L with heatLayer
    const heat = L.heatLayer(data, {
      radius: 20,
      blur: 25,
      maxZoom: 14,
      gradient: {
        0.0: '#ff6b6b',
        0.4: '#f7b731',
        0.7: '#6e7fff',
        1.0: '#4edea3',
      },
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [data, map]);

  return null;
}
