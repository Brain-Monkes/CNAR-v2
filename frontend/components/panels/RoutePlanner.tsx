'use client';
import { useRouting } from '@/context/RoutingContext';
import { api } from '@/lib/api';
import { MapPin, Navigation, Loader2, X, Crosshair, Plus, Trash2, LocateFixed, Radio, Zap, Signal } from 'lucide-react';
import { useState, FormEvent, useEffect } from 'react';
import { getConnectivityColor, getConnectivityLabel } from '@/lib/signal';

export function RoutePlanner() {
  const {
    origin, destination, originLabel, destinationLabel,
    setOrigin, setDestination, calculateRoutes,
    isLoading, error, routes, preferenceWeight,
    setPreferenceWeight, selectionMode, setSelectionMode, clearAll,
    waypoints, addWaypoint, removeWaypoint,
    showTowers, setShowTowers, routeTowers,
  } = useRouting();

  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');

  useEffect(() => {
    if (originLabel) setOriginInput(originLabel);
    else setOriginInput('');
  }, [originLabel]);

  useEffect(() => {
    if (destinationLabel) setDestInput(destinationLabel);
    else setDestInput('');
  }, [destinationLabel]);

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
            <input type="text" className="text-input" placeholder="Search location..." value={originInput}
              onChange={e => setOriginInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode('origin'))} />
            <button type="button" onClick={() => setSelectionMode(selectionMode === 'origin' ? null : 'origin')}
              className={`pin-btn ${selectionMode === 'origin' ? 'active' : ''}`} title="Pin on Map"><Crosshair size={16} /></button>
          </div>
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
            <input type="text" className="text-input" placeholder="Search location..." value={destInput}
              onChange={e => setDestInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode('destination'))} />
            <button type="button" onClick={() => setSelectionMode(selectionMode === 'destination' ? null : 'destination')}
              className={`pin-btn ${selectionMode === 'destination' ? 'active' : ''}`} title="Pin on Map"><Crosshair size={16} /></button>
          </div>
        </div>

        {/* Tower Visibility Toggle — only shown after routes exist */}
        {routes.length > 0 && routeTowers.length > 0 && (
          <button type="button" className={`add-stop-btn ${showTowers ? 'active' : ''}`}
            onClick={() => setShowTowers(!showTowers)}
            style={{ 
              borderColor: showTowers ? 'var(--primary)' : 'var(--border-subtle)', 
              color: showTowers ? 'var(--primary)' : 'var(--text-muted)', 
              background: showTowers ? 'rgba(110, 127, 255, 0.05)' : 'transparent' 
            }}>
            <Radio size={14} /> {showTowers ? `Hide towers along route` : `Show ${routeTowers.length.toLocaleString()} towers along route`}
          </button>
        )}

        {/* Preference Slider */}
        <div className="slider-group">
          <label className="input-label">Route Preference</label>
          <div className="slider-labels">
            <span className="slider-label-left"><Zap size={14} /> Fastest</span>
            <span className="slider-value">{Math.round(preferenceWeight * 100)}%</span>
            <span className="slider-label-right"><Signal size={14} /> Connected</span>
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
