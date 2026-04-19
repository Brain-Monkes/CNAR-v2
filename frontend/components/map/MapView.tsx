'use client';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useRouting } from '@/context/RoutingContext';
import { RouteLayer } from './RouteLayer';
import { HeatmapLayer } from './HeatmapLayer';
import { ColoredHeatmapLayer, HeatmapColorMode } from './ColoredHeatmapLayer';
import { TowerClusterLayer } from './TowerClusterLayer';
import { api } from '@/lib/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useRef } from 'react';

const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const waypointIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function MapStateTracker() {
  const { setMapView } = useRouting();
  const map = useMap();
  useEffect(() => {
    const handler = () => { const c = map.getCenter(); setMapView([c.lat, c.lng], map.getZoom()); };
    map.on('moveend', handler); map.on('zoomend', handler);
    return () => { map.off('moveend', handler); map.off('zoomend', handler); };
  }, [map, setMapView]);
  return null;
}

function MapViewRestorer({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const restored = useRef(false);
  useEffect(() => { if (!restored.current) { map.setView(center, zoom, { animate: false }); restored.current = true; } }, [map, center, zoom]);
  return null;
}

function MapClickHandler() {
  const { selectionMode, setOrigin, setDestination, addWaypoint } = useRouting();
  useMapEvents({
    click: async (e) => {
      if (!selectionMode) return;
      const { lat, lng } = e.latlng;
      const label = await api.reverseGeocode(lat, lng);
      if (selectionMode === 'origin') setOrigin([lat, lng], label);
      else if (selectionMode === 'destination') setDestination([lat, lng], label);
      else if (selectionMode === 'waypoint') addWaypoint([lat, lng], label);
    },
  });
  return null;
}

interface MapViewProps { showHeatmap?: boolean; showRoutes?: boolean; className?: string; heatmapColorMode?: HeatmapColorMode; }

export function MapView({ showHeatmap = false, showRoutes = true, className = '', heatmapColorMode = 'default' }: MapViewProps) {
  const {
    origin, destination, waypoints, routes, selectedRouteId,
    selectRoute, selectionMode, filteredHeatmap, filteredTowerData,
    originLabel, destinationLabel, mapCenter, mapZoom, theme, mapTheme,
    routeTowers, radioTypes, operatorList, showTowers,
  } = useRouting();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (selectionMode) {
      const labels = { origin: 'Origin', destination: 'Destination', waypoint: 'Stop' };
      setToast(`Click anywhere on the map to set your ${labels[selectionMode]}`);
    } else { setToast(null); }
  }, [selectionMode]);

  const tileUrl = mapTheme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  // Route towers: automatically shown when routes exist (no toggle needed)
  const routeTowerData = routeTowers.map(([lat, lon, intensity]) => [lat, lon, intensity] as [number, number, number]);

  return (
    <div className={`map-container ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {toast && <div className="map-toast"><div className="map-toast-inner">{toast}</div></div>}
      <MapContainer center={mapCenter} zoom={mapZoom} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; CartoDB &copy; OSM' url={tileUrl} key={tileUrl} />
        <MapStateTracker />
        <MapViewRestorer center={mapCenter} zoom={mapZoom} />
        <MapClickHandler />

        {showHeatmap && heatmapColorMode !== 'default' && filteredTowerData.length > 0 && (
          <ColoredHeatmapLayer data={filteredTowerData} radioTypes={radioTypes} operatorList={operatorList} mode={heatmapColorMode} />
        )}
        {showHeatmap && heatmapColorMode === 'default' && filteredHeatmap.length > 0 && <HeatmapLayer data={filteredHeatmap} />}
        {showRoutes && routes.map((route) => (
          <RouteLayer key={route.id} route={route} isSelected={route.id === selectedRouteId} onClick={() => selectRoute(route.id)} />
        ))}

        {/* Show towers along route corridors (controlled by toggle) */}
        {showRoutes && showTowers && routeTowerData.length > 0 && (
          <TowerClusterLayer data={routeTowerData} />
        )}

        {origin && <Marker position={origin} icon={originIcon}><Popup><div style={{ fontFamily: 'DM Sans' }}><strong>Origin</strong><br />{originLabel || `${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}`}</div></Popup></Marker>}
        {waypoints.map((wp, i) => (
          <Marker key={`wp_${i}`} position={wp.coords} icon={waypointIcon}>
            <Popup><div style={{ fontFamily: 'DM Sans' }}><strong>Stop {i + 1}</strong><br />{wp.label || `${wp.coords[0].toFixed(4)}, ${wp.coords[1].toFixed(4)}`}</div></Popup>
          </Marker>
        ))}
        {destination && <Marker position={destination} icon={destinationIcon}><Popup><div style={{ fontFamily: 'DM Sans' }}><strong>Destination</strong><br />{destinationLabel || `${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}`}</div></Popup></Marker>}
      </MapContainer>
    </div>
  );
}
