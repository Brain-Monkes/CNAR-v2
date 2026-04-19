'use client';
import dynamic from 'next/dynamic';
import { useRouting } from '@/context/RoutingContext';
import { useEffect, useMemo, useState } from 'react';
import type { HeatmapColorMode } from '@/components/map/ColoredHeatmapLayer';
import {
  Radio, Wifi, WifiOff, Activity, BarChart3,
  Layers, Filter, Zap, Eye, EyeOff
} from 'lucide-react';

const MapView = dynamic(
  () => import('@/components/map/MapView').then(m => ({ default: m.MapView })),
  { ssr: false, loading: () => <div className="ana-map-skeleton" /> }
);

/* ─── static color maps ─── */
const radioColors: Record<string, string> = {
  '5G': '#4edea3', '4G': '#6e7fff', '3G': '#ff9100',
};

const operatorColors: Record<string, string> = {
  'AirTel': '#ff5252', 'Vi (Vodafone Idea)': '#e040fb',
  'Jio': '#448aff', 'BSNL': '#ffd740',
};

/* ─── Donut component (bigger, with animated stroke) ─── */
function Donut({ segments, centerText, centerSub, size = 180 }: {
  segments: { label: string; pct: number; color: string; count: number; dashArray: string; dashOffset: number }[];
  centerText: string; centerSub: string; size?: number;
}) {
  const r = 15.9;
  const vb = 42;
  return (
    <div className="ana-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
        <circle cx="21" cy="21" r={r} fill="transparent"
          stroke="rgba(128,128,128,0.08)" strokeWidth="4.5" />
        {segments.map((seg, i) => (
          <circle key={i} cx="21" cy="21" r={r} fill="transparent"
            stroke={seg.color} strokeWidth="4.5"
            strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset}
            strokeLinecap="round" transform="rotate(-90 21 21)"
            className="ana-donut-seg" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
        <text x="21" y="19.5" textAnchor="middle" fill="var(--text-primary)"
          fontSize="5.5" fontFamily="var(--font-display)" fontWeight="800">{centerText}</text>
        <text x="21" y="24" textAnchor="middle" fill="var(--text-muted)"
          fontSize="2.6" fontFamily="var(--font-body)">{centerSub}</text>
      </svg>
    </div>
  );
}

/* ─── legend entries ─── */
function Legend({ segments }: {
  segments: { label: string; pct: number; color: string; count: number }[];
}) {
  return (
    <div className="ana-legend">
      {segments.map((s, i) => (
        <div key={i} className="ana-legend-row">
          <span className="ana-legend-dot" style={{ background: s.color }} />
          <span className="ana-legend-label">{s.label}</span>
          <span className="ana-legend-count">{s.count.toLocaleString()}</span>
          <span className="ana-legend-pct">{s.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ─── helper: build donut segments ─── */
function buildDonut(data: Record<string, number>, colorMap: Record<string, string>) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => {
      const pct = (count / total) * 100;
      const seg = {
        label, count, color: colorMap[label] || '#666',
        pct, dashArray: `${pct} ${100 - pct}`, dashOffset: -offset,
      };
      offset += pct;
      return seg;
    });
}

/* ─── Filter chip ─── */
function Chip({ label, color, count, active, onToggle }: {
  label: string; color: string; count: number; active: boolean; onToggle: () => void;
}) {
  return (
    <button className={`ana-chip ${active ? 'active' : 'off'}`} onClick={onToggle}
      style={{ '--chip-color': color } as React.CSSProperties}>
      <span className="ana-chip-dot" />
      <span className="ana-chip-label">{label}</span>
      <span className="ana-chip-count">{count.toLocaleString()}</span>
      {active ? <Eye size={12} /> : <EyeOff size={12} />}
    </button>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━ MAIN PAGE ━━━━━━━━━━━━━━━━━━━━━━ */
export default function AnalyticsPage() {
  const {
    towerData, totalTowers, radioTypes, operatorList,
    towerFilters, setTowerFilters, fetchHeatmap,
    fullStats, crossStats,
  } = useRouting();

  // Fetch ALL towers — limit=0 sends the full dataset for complete heatmap coverage
  useEffect(() => { if (towerData.length === 0) fetchHeatmap(0); }, [towerData.length, fetchHeatmap]);

  /* ─── stats ─── */
  const totalStats = useMemo(() => ({
    total: totalTowers || towerData.length,
    byRadio: fullStats.byRadio,
    byOperator: fullStats.byOperator,
  }), [totalTowers, towerData.length, fullStats]);

  const filteredStats = useMemo(() => {
    const byRadio: Record<string, number> = {};
    const byOperator: Record<string, number> = {};
    let total = 0;
    radioTypes.forEach(r => { byRadio[r] = 0; });
    operatorList.forEach(o => { byOperator[o] = 0; });
    for (const r of radioTypes) {
      if (!(towerFilters.radios[r] ?? true)) continue;
      for (const op of operatorList) {
        if (!(towerFilters.operators[op] ?? true)) continue;
        const count = crossStats[r]?.[op] ?? 0;
        byRadio[r] += count;
        byOperator[op] += count;
        total += count;
      }
    }
    return { total, byRadio, byOperator };
  }, [radioTypes, operatorList, towerFilters, crossStats]);

  const toggleRadio = (r: string) =>
    setTowerFilters({ ...towerFilters, radios: { ...towerFilters.radios, [r]: !(towerFilters.radios[r] ?? true) } });
  const toggleOperator = (o: string) =>
    setTowerFilters({ ...towerFilters, operators: { ...towerFilters.operators, [o]: !(towerFilters.operators[o] ?? true) } });

  const radioDonut = useMemo(() => buildDonut(filteredStats.byRadio, radioColors), [filteredStats.byRadio]);
  const operatorDonut = useMemo(() => buildDonut(filteredStats.byOperator, operatorColors), [filteredStats.byOperator]);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapColorMode>('default');

  const coveragePct = totalStats.total > 0
    ? ((filteredStats.total / totalStats.total) * 100).toFixed(1) : '0';

  const fiveGPct = filteredStats.total > 0
    ? ((filteredStats.byRadio['5G'] || 0) / filteredStats.total * 100).toFixed(1) : '0';

  return (
    <div className="ana-page">
      {/* ─── Header ─── */}
      <header className="ana-header">
        <div className="ana-header-left">
          <BarChart3 size={20} className="ana-header-icon" />
          <h1 className="ana-header-title">Network Analytics</h1>
          <span className="ana-header-badge">{totalStats.total.toLocaleString()} towers</span>
        </div>
        <div className="ana-heatmap-toggle">
          {(['default', 'radio', 'operator'] as HeatmapColorMode[]).map(m => (
            <button key={m} className={`ana-htog ${heatmapMode === m ? 'active' : ''}`}
              onClick={() => setHeatmapMode(m)}>
              {m === 'default' ? 'Signal' : m === 'radio' ? 'Radio' : 'Operator'}
            </button>
          ))}
        </div>
      </header>

      {/* ─── Bento Grid ─── */}
      <div className="ana-grid">

        {/* ── Stat: Total Towers ── */}
        <div className="ana-card ana-stat-total" style={{ '--card-delay': '0ms' } as React.CSSProperties}>
          <div className="ana-stat-icon-wrap" style={{ background: 'rgba(110,127,255,0.12)' }}>
            <Radio size={20} color="var(--primary)" />
          </div>
          <div className="ana-stat-num">{totalStats.total.toLocaleString()}</div>
          <div className="ana-stat-lbl">Total Towers</div>
          <div className="ana-stat-sub">Full dataset loaded</div>
        </div>

        {/* ── Stat: Visible Towers ── */}
        <div className="ana-card ana-stat-visible" style={{ '--card-delay': '60ms' } as React.CSSProperties}>
          <div className="ana-stat-icon-wrap" style={{ background: 'rgba(78,222,163,0.12)' }}>
            <Activity size={20} color="var(--accent)" />
          </div>
          <div className="ana-stat-num" style={{ color: 'var(--accent)' }}>{filteredStats.total.toLocaleString()}</div>
          <div className="ana-stat-lbl">Visible After Filters</div>
          <div className="ana-stat-sub">{coveragePct}% of total</div>
        </div>

        {/* ── Stat: 5G Coverage ── */}
        <div className="ana-card ana-stat-5g" style={{ '--card-delay': '120ms' } as React.CSSProperties}>
          <div className="ana-stat-icon-wrap" style={{ background: 'rgba(78,222,163,0.12)' }}>
            <Zap size={20} color="var(--signal-5g)" />
          </div>
          <div className="ana-stat-num" style={{ color: 'var(--signal-5g)' }}>{(filteredStats.byRadio['5G'] || 0).toLocaleString()}</div>
          <div className="ana-stat-lbl">5G Towers</div>
          <div className="ana-stat-sub">{fiveGPct}% of visible</div>
        </div>

        {/* ── Stat: Dead Zones (no-coverage metric) ── */}
        <div className="ana-card ana-stat-dead" style={{ '--card-delay': '180ms' } as React.CSSProperties}>
          <div className="ana-stat-icon-wrap" style={{ background: 'rgba(255,107,107,0.12)' }}>
            <WifiOff size={20} color="var(--danger)" />
          </div>
          <div className="ana-stat-num" style={{ color: 'var(--danger)' }}>{(filteredStats.byRadio['3G'] || 0).toLocaleString()}</div>
          <div className="ana-stat-lbl">3G Towers</div>
          <div className="ana-stat-sub">Legacy coverage</div>
        </div>

        {/* ── MAP (takes 2 cols, 2 rows) ── */}
        <div className="ana-card ana-map-card" style={{ '--card-delay': '100ms' } as React.CSSProperties}>
          <MapView showHeatmap={true} showRoutes={false} heatmapColorMode={heatmapMode} />
        </div>

        {/* ── Radio Donut ── */}
        <div className="ana-card ana-donut-card" style={{ '--card-delay': '200ms' } as React.CSSProperties}>
          <div className="ana-card-head">
            <Wifi size={16} />
            <h3>Radio Distribution</h3>
          </div>
          <Donut segments={radioDonut}
            centerText={filteredStats.total.toLocaleString()} centerSub="towers" />
          <Legend segments={radioDonut} />
        </div>

        {/* ── Operator Donut ── */}
        <div className="ana-card ana-donut-card" style={{ '--card-delay': '260ms' } as React.CSSProperties}>
          <div className="ana-card-head">
            <Layers size={16} />
            <h3>Operator Distribution</h3>
          </div>
          <Donut segments={operatorDonut}
            centerText={filteredStats.total.toLocaleString()} centerSub="towers" />
          <Legend segments={operatorDonut} />
        </div>

        {/* ── Filters: Radio ── */}
        <div className="ana-card ana-filter-card" style={{ '--card-delay': '300ms' } as React.CSSProperties}>
          <div className="ana-card-head">
            <Filter size={16} />
            <h3>Filter by Radio</h3>
          </div>
          <div className="ana-chip-grid">
            {radioTypes.map(r => (
              <Chip key={r} label={r} color={radioColors[r] || '#666'}
                count={totalStats.byRadio[r] || 0}
                active={towerFilters.radios[r] ?? true}
                onToggle={() => toggleRadio(r)} />
            ))}
          </div>
        </div>

        {/* ── Filters: Operator ── */}
        <div className="ana-card ana-filter-card" style={{ '--card-delay': '360ms' } as React.CSSProperties}>
          <div className="ana-card-head">
            <Filter size={16} />
            <h3>Filter by Operator</h3>
          </div>
          <div className="ana-chip-grid">
            {operatorList.map(op => (
              <Chip key={op} label={op} color={operatorColors[op] || '#666'}
                count={totalStats.byOperator[op] || 0}
                active={towerFilters.operators[op] ?? true}
                onToggle={() => toggleOperator(op)} />
            ))}
          </div>
        </div>

        {/* ── Breakdown Table ── 
        <div className="ana-card ana-table-card" style={{ '--card-delay': '400ms' } as React.CSSProperties}>
          <div className="ana-card-head">
            <BarChart3 size={16} />
            <h3>Radio Breakdown</h3>
          </div>
          <table className="ana-table">
            <thead>
              <tr><th>Radio</th><th>Visible</th><th>Total</th><th>Share</th></tr>
            </thead>
            <tbody>
              {radioTypes.map(r => {
                const vis = filteredStats.byRadio[r] || 0;
                const tot = totalStats.byRadio[r] || 0;
                const sharePct = filteredStats.total > 0 ? (vis / filteredStats.total * 100).toFixed(1) : '0';
                return (
                  <tr key={r}>
                    <td>
                      <span className="ana-table-dot" style={{ background: radioColors[r] || '#666' }} />
                      {r}
                    </td>
                    <td className="mono">{vis.toLocaleString()}</td>
                    <td className="mono muted">{tot.toLocaleString()}</td>
                    <td>
                      <div className="ana-mini-bar">
                        <div className="ana-mini-fill" style={{
                          width: `${sharePct}%`, background: radioColors[r] || '#666'
                        }} />
                      </div>
                      <span className="mono tiny">{sharePct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>*/}
        
      </div>
    </div>
  );
}
