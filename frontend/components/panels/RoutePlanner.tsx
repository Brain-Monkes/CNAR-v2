'use client';
import { useRouting } from '@/context/RoutingContext';
import { api } from '@/lib/api';
import { MapPin, Navigation, Loader2, X, Crosshair, Radio, Plus, Trash2, LocateFixed } from 'lucide-react';
import { useState, FormEvent, useEffect } from 'react';
import { getConnectivityColor, getConnectivityLabel } from '@/lib/signal';

export function RoutePlanner() {
  const {
    origin, destination, originLabel, destinationLabel,
    setOrigin, setDestination, calculateRoutes,
    isLoading, error, routes, preferenceWeight,
    setPreferenceWeight, selectionMode, setSelectionMode, clearAll,
    showTowers, setShowTowers, fetchHeatmap, towerData,
    waypoints, addWaypoint, removeWaypoint,
  } = useRouting();

  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');

  useEffect(() => {
    if (showTowers && towerData.length === 0) fetchHeatmap();
  }, [showTowers, towerData.length, fetchHeatmap]);

  const handleGeocode = async (type: 'origin' | 'destination') => {
    const query = type === 'origin' ? originInput : destInput;
    if (!query.trim()) return;
    const result = await api.geocode(query);
    if (result) {
      if (type === 'origin') { setOrigin([result.lat, result.lon], result.label); setOriginInput(result.label); }
      else { setDestination([result.lat, result.lon], result.label); setDestInput(result.label); }
    }
  };

  const handleSubmit = async (e: FormEvent) => { e.preventDefault(); await calculateRoutes(); };
  const topRoute = routes[0];

  return (
    <div className="route-planner">
      <div className="route-planner-header">
        <h2 className="route-planner-title">Route Planner</h2>
        {(origin || destination) && <button onClick={clearAll} className="clear-btn" title="Clear all"><X size={16} /></button>}
      </div>

      <form onSubmit={handleSubmit} className="route-planner-form">
        {/* Origin */}
        <div className="input-group">
          <label className="input-label"><MapPin size={14} className="label-icon origin-icon" /> Origin</label>
          <div className="input-row">
            <input type="text" className="text-input" placeholder={originLabel || 'Search location...'} value={originInput}
              onChange={e => setOriginInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode('origin'))} />
            <button type="button" onClick={() => setSelectionMode(selectionMode === 'origin' ? null : 'origin')}
              className={`pin-btn ${selectionMode === 'origin' ? 'active' : ''}`} title="Pin on Map"><Crosshair size={16} /></button>
          </div>
          {originLabel && <span className="input-hint">{originLabel.substring(0, 60)}</span>}
        </div>

        {/* Waypoints */}
        {waypoints.map((wp, i) => (
          <div key={i} className="input-group waypoint-group">
            <label className="input-label"><LocateFixed size={14} className="label-icon" style={{ color: '#f7b731' }} /> Stop {i + 1}</label>
            <div className="input-row">
              <input type="text" className="text-input" value={wp.label.substring(0, 50)} readOnly placeholder="Stop location" />
              <button type="button" onClick={() => removeWaypoint(i)} className="pin-btn remove-btn" title="Remove stop"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        {/* Add Stop Button */}
        {origin && (
          <button type="button" className="add-stop-btn"
            onClick={() => setSelectionMode(selectionMode === 'waypoint' ? null : 'waypoint')}>
            <Plus size={14} /> {selectionMode === 'waypoint' ? 'Click map to place stop...' : 'Add Stop'}
          </button>
        )}

        {/* Destination */}
        <div className="input-group">
          <label className="input-label"><Navigation size={14} className="label-icon dest-icon" /> Destination</label>
          <div className="input-row">
            <input type="text" className="text-input" placeholder={destinationLabel || 'Search location...'} value={destInput}
              onChange={e => setDestInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode('destination'))} />
            <button type="button" onClick={() => setSelectionMode(selectionMode === 'destination' ? null : 'destination')}
              className={`pin-btn ${selectionMode === 'destination' ? 'active' : ''}`} title="Pin on Map"><Crosshair size={16} /></button>
          </div>
          {destinationLabel && <span className="input-hint">{destinationLabel.substring(0, 60)}</span>}
        </div>

        {/* Tower Toggle */}
        <label className="tower-toggle">
          <input type="checkbox" checked={showTowers} onChange={e => setShowTowers(e.target.checked)} />
          <Radio size={14} /><span>Show Tower Clusters on Map</span>
        </label>

        {/* Preference Slider */}
        <div className="slider-group">
          <label className="input-label">Route Preference</label>
          <div className="slider-labels">
            <span className="slider-label-left">⚡ Fastest</span>
            <span className="slider-value">{Math.round(preferenceWeight * 100)}%</span>
            <span className="slider-label-right">📶 Connected</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={preferenceWeight}
            onChange={e => setPreferenceWeight(parseFloat(e.target.value))} className="preference-slider" />
        </div>

        <button type="submit" className="calculate-btn" disabled={!origin || !destination || isLoading}>
          {isLoading ? (<><Loader2 size={18} className="spinner" /> Calculating...</>) : 'Calculate Routes'}
        </button>

        {error && <div className="error-message"><span>⚠️ {error}</span></div>}

        {topRoute && !isLoading && (
          <div className="route-summary">
            <div className="summary-title">Top Route Summary</div>
            <div className="summary-chips">
              <div className="chip"><span className="chip-label">Distance</span><span className="chip-value">{topRoute.distance_km} km</span></div>
              <div className="chip"><span className="chip-label">Duration</span><span className="chip-value">{topRoute.duration_min} min</span></div>
              <div className="chip"><span className="chip-label">Signal</span><span className="chip-value" style={{ color: getConnectivityColor(topRoute.connectivity_score) }}>{getConnectivityLabel(topRoute.connectivity_score)}</span></div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
