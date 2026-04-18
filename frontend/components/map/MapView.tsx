'use client';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useRouting } from '@/context/RoutingContext';
import { RouteLayer } from './RouteLayer';
import { HeatmapLayer } from './HeatmapLayer';
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

/** Syncs map center/zoom to context so it persists across page nav */
function MapStateTracker() {
  const { setMapView } = useRouting();
  const map = useMap();

  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      setMapView([c.lat, c.lng], map.getZoom());
    };
    map.on('moveend', handler);
    map.on('zoomend', handler);
    return () => {
      map.off('moveend', handler);
      map.off('zoomend', handler);
    };
  }, [map, setMapView]);

  return null;
}

/** Restores map view from context on mount */
function MapViewRestorer({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const restored = useRef(false);

  useEffect(() => {
    if (!restored.current) {
      map.setView(center, zoom, { animate: false });
      restored.current = true;
    }
  }, [map, center, zoom]);

  return null;
}

function MapClickHandler() {
  const { selectionMode, setOrigin, setDestination } = useRouting();

  useMapEvents({
    click: async (e) => {
      if (!selectionMode) return;
      const { lat, lng } = e.latlng;
      const label = await api.reverseGeocode(lat, lng);
      if (selectionMode === 'origin') {
        setOrigin([lat, lng], label);
      } else {
        setDestination([lat, lng], label);
      }
    },
  });

  return null;
}

interface MapViewProps {
  showHeatmap?: boolean;
  showRoutes?: boolean;
  className?: string;
}

export function MapView({ showHeatmap = false, showRoutes = true, className = '' }: MapViewProps) {
  const {
    origin, destination, routes, selectedRouteId,
    selectRoute, selectionMode, heatmapData, originLabel, destinationLabel,
    mapCenter, mapZoom, theme, showTowers,
  } = useRouting();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (selectionMode) {
      const target = selectionMode === 'origin' ? 'Origin' : 'Destination';
      setToast(`Click anywhere on the map to set your ${target}`);
    } else {
      setToast(null);
    }
  }, [selectionMode]);

  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className={`map-container ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {toast && (
        <div className="map-toast">
          <div className="map-toast-inner">{toast}</div>
        </div>
      )}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={tileUrl}
          key={tileUrl}
        />

        <MapStateTracker />
        <MapViewRestorer center={mapCenter} zoom={mapZoom} />
        <MapClickHandler />

        {showHeatmap && heatmapData.length > 0 && (
          <HeatmapLayer data={heatmapData} />
        )}

        {showRoutes && routes.map((route) => (
          <RouteLayer
            key={route.id}
            route={route}
            isSelected={route.id === selectedRouteId}
            onClick={() => selectRoute(route.id)}
          />
        ))}

        {showTowers && heatmapData.length > 0 && (
          <TowerClusterLayer data={heatmapData} />
        )}

        {origin && (
          <Marker position={origin} icon={originIcon}>
            <Popup>
              <div style={{ color: '#090e1a', fontFamily: 'DM Sans, sans-serif' }}>
                <strong>Origin</strong><br />
                {originLabel || `${origin[0].toFixed(4)}, ${origin[1].toFixed(4)}`}
              </div>
            </Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={destination} icon={destinationIcon}>
            <Popup>
              <div style={{ color: '#090e1a', fontFamily: 'DM Sans, sans-serif' }}>
                <strong>Destination</strong><br />
                {destinationLabel || `${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}`}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
