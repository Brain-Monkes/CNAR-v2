'use client';
import dynamic from 'next/dynamic';
import { useRouting } from '@/context/RoutingContext';
import { RouteCard } from '@/components/panels/RouteCard';
import { TelemetryLog } from '@/components/panels/TelemetryLog';
import { Route } from 'lucide-react';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }} />,
});

export default function RoutesPage() {
  const { routes, selectedRouteId, selectRoute, selectedRoute, telemetryForRoute, totalTowers } = useRouting();

  return (
    <div className="routes-page">
      <div className="routes-sidebar">
        <div>
          <h2 className="routes-sidebar-title">Route Comparison</h2>
          <p className="routes-sidebar-subtitle">
            {routes.length > 0
              ? `${routes.length} routes found — select one to view details`
              : 'Calculate routes from the Dashboard first'}
          </p>
          {routes.length > 0 && totalTowers > 0 && (
            <p className="routes-sidebar-subtitle" style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>
              Scored against {totalTowers.toLocaleString()} towers
            </p>
          )}
        </div>

        {routes.length === 0 ? (
          <div className="routes-empty">
            <Route size={48} className="routes-empty-icon" />
            <p>No routes calculated yet.</p>
            <p style={{ fontSize: '12px' }}>Go to Dashboard to set origin &amp; destination.</p>
          </div>
        ) : (
          routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              isSelected={route.id === selectedRouteId}
              onSelect={() => selectRoute(route.id)}
            />
          ))
        )}
      </div>

      {/* Right side: Map + Telemetry */}
      <div className="routes-right">
        <div className="routes-map">
          <MapView showRoutes={true} showHeatmap={false} />
        </div>
        {selectedRoute && (
          <div className="routes-telemetry">
            <TelemetryLog entries={telemetryForRoute(selectedRoute)} routeLabel={selectedRoute.label} />
          </div>
        )}
      </div>
    </div>
  );
}
