'use client';
import dynamic from 'next/dynamic';
import { RoutePlanner } from '@/components/panels/RoutePlanner';
import { TelemetryLog } from '@/components/panels/TelemetryLog';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }} />,
});

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <MapView showRoutes={true} showHeatmap={false} />
      <RoutePlanner />
      <TelemetryLog />
    </div>
  );
}
