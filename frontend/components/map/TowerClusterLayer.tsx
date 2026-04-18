/**
 * Tower cluster layer using react-leaflet-cluster for marker clustering.
 * Renders a geographically uniform sample when tower count exceeds the limit.
 */
'use client';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';

interface Props {
  data: [number, number, number][]; // [lat, lon, intensity]
}

const MAX_MARKERS = 15000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  let size = 'small';
  let diameter = 30;
  if (count > 100) { size = 'large'; diameter = 50; }
  else if (count > 30) { size = 'medium'; diameter = 40; }
  return L.divIcon({
    html: `<div class="tower-cluster tower-cluster-${size}"><span>${count}</span></div>`,
    className: 'tower-cluster-wrapper',
    iconSize: L.point(diameter, diameter),
  });
}

const towerIcon3G = L.divIcon({ html: '<div class="tower-dot tower-dot-3g"></div>', className: 'tower-dot-wrapper', iconSize: [8, 8], iconAnchor: [4, 4] });
const towerIcon4G = L.divIcon({ html: '<div class="tower-dot tower-dot-4g"></div>', className: 'tower-dot-wrapper', iconSize: [10, 10], iconAnchor: [5, 5] });
const towerIcon5G = L.divIcon({ html: '<div class="tower-dot tower-dot-5g"></div>', className: 'tower-dot-wrapper', iconSize: [12, 12], iconAnchor: [6, 6] });

function getTowerIcon(intensity: number) {
  if (intensity >= 0.9) return towerIcon5G;   // 5G = 10/10 = 1.0
  if (intensity >= 0.6) return towerIcon4G;   // 4G = 7/10 = 0.7
  return towerIcon3G;                          // 3G = 3/10 = 0.3
}

function getTowerLabel(intensity: number) {
  if (intensity >= 0.9) return '5G';
  if (intensity >= 0.6) return '4G';
  return '3G';
}

export function TowerClusterLayer({ data }: Props) {
  // Uniformly sample if too many markers — pick every Nth point for even geographic distribution
  const visibleData = useMemo(() => {
    if (data.length <= MAX_MARKERS) return data;
    const step = Math.ceil(data.length / MAX_MARKERS);
    const sampled: [number, number, number][] = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    return sampled;
  }, [data]);

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      iconCreateFunction={createClusterIcon}
      disableClusteringAtZoom={15}
      spiderfyOnMaxZoom={false}
      showCoverageOnHover={false}
    >
      {visibleData.map(([lat, lon, intensity], i) => (
        <Marker key={i} position={[lat, lon]} icon={getTowerIcon(intensity)}>
          <Popup>
            <div style={{ color: '#090e1a', fontFamily: 'DM Sans, sans-serif', fontSize: '12px' }}>
              <strong>{getTowerLabel(intensity)} Tower</strong><br />
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}
