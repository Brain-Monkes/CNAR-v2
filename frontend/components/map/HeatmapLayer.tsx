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
        0.0: '#1a0533',
        0.3: '#6a1b9a',
        0.5: '#00bcd4',
        0.7: '#80deea',
        1.0: '#e0f7fa',
      },
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [data, map]);

  return null;
}
