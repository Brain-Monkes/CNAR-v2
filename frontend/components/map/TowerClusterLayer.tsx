/**
 * Tower cluster layer using react-leaflet-cluster for marker clustering.
 * Shows individual tower markers at high zoom, clusters at low zoom.
 */
'use client';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  data: [number, number, number][]; // [lat, lon, intensity]
}

function createClusterIcon(cluster: L.MarkerCluster) {
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

const towerIcon4G = L.divIcon({
  html: '<div class="tower-dot tower-dot-4g"></div>',
  className: 'tower-dot-wrapper',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const towerIcon5G = L.divIcon({
  html: '<div class="tower-dot tower-dot-5g"></div>',
  className: 'tower-dot-wrapper',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export function TowerClusterLayer({ data }: Props) {
  // Limit rendering to 15000 markers for performance
  const visibleData = data.length > 15000 ? data.slice(0, 15000) : data;

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
        <Marker
          key={i}
          position={[lat, lon]}
          icon={intensity >= 0.9 ? towerIcon5G : towerIcon4G}
        >
          <Popup>
            <div style={{ color: '#090e1a', fontFamily: 'DM Sans, sans-serif', fontSize: '12px' }}>
              <strong>{intensity >= 0.9 ? '5G' : '4G'} Tower</strong><br />
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}
