'use client';
import { TelemetryEntry } from '@/types';
import { useRouting } from '@/context/RoutingContext';
import { AlertTriangle, CheckCircle, Info, Radio, X } from 'lucide-react';

const severityIcons = {
  danger: AlertTriangle,
  warning: Radio,
  success: CheckCircle,
  info: Info,
};

export function TelemetryLog() {
  const { telemetryLog, clearTelemetry } = useRouting();

  if (telemetryLog.length === 0) return null;

  return (
    <div className="telemetry-panel">
      <div className="telemetry-header">
        <h3 className="telemetry-title">Telemetry Log</h3>
        <button onClick={clearTelemetry} className="clear-btn" title="Clear log">
          <X size={14} />
        </button>
      </div>
      <div className="telemetry-entries">
        {telemetryLog.map((entry: TelemetryEntry) => {
          const Icon = severityIcons[entry.severity];
          return (
            <div key={entry.id} className={`telemetry-entry telemetry-${entry.severity}`}>
              <Icon size={14} className="telemetry-icon" />
              <span className="telemetry-message">{entry.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
