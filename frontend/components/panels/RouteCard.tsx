'use client';
import { RouteObject } from '@/types';
import { getConnectivityColor, getConnectivityLabel } from '@/lib/signal';
import { Route, Zap, Wifi, Radio, AlertTriangle, ArrowLeftRight, Signal } from 'lucide-react';

interface Props {
  route: RouteObject;
  isSelected: boolean;
  onSelect: () => void;
}

export function RouteCard({ route, isSelected, onSelect }: Props) {
  const connColor = getConnectivityColor(route.connectivity_score);
  const connLabel = getConnectivityLabel(route.connectivity_score);

  const coverageColor =
    route.coverage_pct >= 80 ? '#4edea3' :
    route.coverage_pct >= 50 ? '#6e7fff' : '#ff6b6b';

  const deadZoneColor =
    route.dead_zone_count === 0 ? '#4edea3' :
    route.dead_zone_count <= 2 ? '#f7b731' : '#ff6b6b';

  return (
    <div className={`route-card ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="route-card-header">
        <div className="route-card-icon">
          {route.is_fastest ? <Zap size={18} /> : route.is_most_connected ? <Wifi size={18} /> : <Route size={18} />}
        </div>
        <div className="route-card-label">{route.label}</div>
        <div className="route-card-badges">
          {route.is_fastest && <span className="badge badge-fastest">Fastest</span>}
          {route.is_most_connected && <span className="badge badge-connected">Best Signal</span>}
        </div>
      </div>

      <div className="route-card-stats">
        <div className="stat"><span className="stat-icon">📏</span><span className="stat-value">{route.distance_km} km</span></div>
        <div className="stat"><span className="stat-icon">⏱</span><span className="stat-value">{route.duration_min} min</span></div>
      </div>

      {/* Signal Index */}
      <div className="route-card-signal">
        <div className="signal-row">
          <span className="signal-label">Signal Index</span>
          <span className="signal-value" style={{ color: connColor }}>{route.connectivity_score.toFixed(1)}% — {connLabel}</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(route.connectivity_score, 100)}%`, backgroundColor: connColor }} /></div>
      </div>

      {/* Coverage */}
      <div className="route-card-coverage">
        <div className="signal-row">
          <span className="signal-label">Route Coverage</span>
          <span className="signal-value" style={{ color: coverageColor }}>{route.coverage_pct.toFixed(1)}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(route.coverage_pct, 100)}%`, backgroundColor: coverageColor }} /></div>
      </div>

      {/* Enhanced Metrics */}
      <div className="route-card-metrics">
        <div className="metric-item">
          <Radio size={14} className="metric-icon" style={{ color: '#6e7fff' }} />
          <span className="metric-label">Towers in Range</span>
          <span className="metric-value">{route.towers_in_range}</span>
        </div>
        <div className="metric-item">
          <AlertTriangle size={14} className="metric-icon" style={{ color: deadZoneColor }} />
          <span className="metric-label">Dead Zones</span>
          <span className="metric-value" style={{ color: deadZoneColor }}>
            {route.dead_zone_count} ({route.dead_zone_pct.toFixed(1)}%)
          </span>
        </div>
        <div className="metric-item">
          <ArrowLeftRight size={14} className="metric-icon" style={{ color: '#f7b731' }} />
          <span className="metric-label">Signal Transitions</span>
          <span className="metric-value">{route.signal_transitions}</span>
        </div>
        <div className="metric-item">
          <Signal size={14} className="metric-icon" style={{ color: connColor }} />
          <span className="metric-label">Avg Signal Strength</span>
          <span className="metric-value">{route.avg_signal.toFixed(1)} / 10</span>
        </div>
      </div>

      <button
        className={`route-select-btn ${isSelected ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {isSelected ? 'Selected' : 'Select This Route'}
      </button>
    </div>
  );
}
