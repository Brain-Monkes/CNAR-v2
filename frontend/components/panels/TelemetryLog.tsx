'use client';
import { TelemetryEntry } from '@/types';
import { AlertTriangle, CheckCircle, Info, Radio } from 'lucide-react';

const severityIcons = {
  danger: AlertTriangle,
  warning: Radio,
  success: CheckCircle,
  info: Info,
};

interface Props {
  entries: TelemetryEntry[];
  routeLabel?: string;
}

export function TelemetryLog({ entries, routeLabel }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="telemetry-panel">
      <div className="telemetry-header">
        <h3 className="telemetry-title">Telemetry — {routeLabel || 'Route'}</h3>
      </div>
      <div className="telemetry-entries">
        {entries.map((entry: TelemetryEntry) => {
          const Icon = severityIcons[entry.severity];
          return (
            <div key={entry.id} className={`telemetry-entry telemetry-${entry.severity}`}>
              <Icon size={16} className="telemetry-icon" />
              <span className="telemetry-message">{entry.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
