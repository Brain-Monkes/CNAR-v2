'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Save, Wifi, WifiOff } from 'lucide-react';

export default function SettingsPage() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const [searchRadius, setSearchRadius] = useState(500);
  const [maxRoutePoints, setMaxRoutePoints] = useState(300);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = localStorage.getItem('cnar_backend_url');
      const radius = localStorage.getItem('cnar_search_radius');
      const points = localStorage.getItem('cnar_max_route_points');
      if (url) setBackendUrl(url);
      if (radius) setSearchRadius(parseInt(radius, 10));
      if (points) setMaxRoutePoints(parseInt(points, 10));
    }
  }, []);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    // Temporarily set the URL for testing
    localStorage.setItem('cnar_backend_url', backendUrl);
    const ok = await api.healthCheck();
    setConnectionStatus(ok ? 'success' : 'error');
  };

  const handleSave = () => {
    localStorage.setItem('cnar_backend_url', backendUrl);
    localStorage.setItem('cnar_search_radius', String(searchRadius));
    localStorage.setItem('cnar_max_route_points', String(maxRoutePoints));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h2 className="settings-title">Settings</h2>

        <div className="settings-form">
          {/* Backend URL */}
          <div className="settings-group">
            <label className="settings-label">Backend URL</label>
            <input
              type="text"
              className="settings-input"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
          </div>

          {/* Search Radius */}
          <div className="settings-group">
            <label className="settings-label">Search Radius (meters)</label>
            <div className="settings-slider-row">
              <input
                type="range"
                className="settings-range"
                min="100"
                max="2000"
                step="50"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))}
              />
              <span className="settings-slider-value">{searchRadius}m</span>
            </div>
          </div>

          {/* Max Route Points */}
          <div className="settings-group">
            <label className="settings-label">Max Route Points</label>
            <div className="settings-slider-row">
              <input
                type="range"
                className="settings-range"
                min="100"
                max="500"
                step="50"
                value={maxRoutePoints}
                onChange={(e) => setMaxRoutePoints(parseInt(e.target.value, 10))}
              />
              <span className="settings-slider-value">{maxRoutePoints}</span>
            </div>
          </div>

          {/* Test Connection */}
          {connectionStatus === 'success' && (
            <div className="settings-status success">
              <Wifi size={16} />
              <span>Backend is reachable and healthy</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="settings-status error">
              <WifiOff size={16} />
              <span>Cannot reach backend at {backendUrl}</span>
            </div>
          )}

          {saved && (
            <div className="settings-status success">
              <Save size={16} />
              <span>Settings saved successfully</span>
            </div>
          )}

          {/* Actions */}
          <div className="settings-actions">
            <button className="btn-secondary" onClick={handleTestConnection} disabled={connectionStatus === 'testing'}>
              {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
