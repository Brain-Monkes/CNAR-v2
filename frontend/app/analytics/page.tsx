'use client';
import dynamic from 'next/dynamic';
import { useRouting } from '@/context/RoutingContext';
import { useEffect, useMemo, useState } from 'react';
import type { HeatmapColorMode } from '@/components/map/ColoredHeatmapLayer';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }} />,
});

const radioColors: Record<string, string> = {
  '5G': '#00e676', '4G': '#448aff', '3G': '#ff9100',
};
const operatorColors: Record<string, string> = {
  'AirTel': '#ff5252', 'Vi (Vodafone Idea)': '#e040fb', 'Jio': '#448aff', 'BSNL': '#ffd740',
};

function Donut({ segments, centerText, centerSubtext }: {
  segments: { label: string; pct: number; color: string; count: number; dashArray: string; dashOffset: number }[];
  centerText: string; centerSubtext: string;
}) {
  return (
    <div className="analytics-donut">
      <svg width="140" height="140" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="rgba(128,128,128,0.1)" strokeWidth="5" />
        {segments.map((seg, i) => (
          <circle key={i} cx="21" cy="21" r="15.9" fill="transparent" stroke={seg.color}
            strokeWidth="5" strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset}
            strokeLinecap="round" transform="rotate(-90 21 21)" style={{ transition: 'all 0.6s ease' }} />
        ))}
        <text x="21" y="20" textAnchor="middle" fill="var(--text-primary)" fontSize="5" fontFamily="var(--font-display)" fontWeight="700">{centerText}</text>
        <text x="21" y="25" textAnchor="middle" fill="var(--text-muted)" fontSize="2.5" fontFamily="var(--font-body)">{centerSubtext}</text>
      </svg>
    </div>
  );
}

function buildDonut(data: Record<string, number>, colorMap: Record<string, string>) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return Object.entries(data).map(([label, count]) => {
    const pct = (count / total) * 100;
    const seg = { label, count, color: colorMap[label] || '#888', pct, dashArray: `${pct} ${100 - pct}`, dashOffset: -offset };
    offset += pct;
    return seg;
  });
}

export default function AnalyticsPage() {
  const { towerData, totalTowers, radioTypes, operatorList, towerFilters, setTowerFilters, fetchHeatmap, filteredTowerData, fullStats, crossStats } = useRouting();

  // Fetch 200K sampled towers — enough for dense heatmap without crashing browser
  // Real stats (radio/operator counts) are still from ALL 1M towers via fullStats
  useEffect(() => { if (towerData.length === 0) fetchHeatmap(200000); }, [towerData.length, fetchHeatmap]);

  // Use real full-dataset stats from backend (all 1,027,787 towers)
  const totalStats = useMemo(() => ({
    total: totalTowers || towerData.length,
    byRadio: fullStats.byRadio,
    byOperator: fullStats.byOperator,
  }), [totalTowers, towerData.length, fullStats]);

  // Filtered stats computed from FULL dataset via crossStats matrix
  // crossStats[radio][operator] = count from ALL 1,027,787 towers
  const filteredStats = useMemo(() => {
    const byRadio: Record<string, number> = {};
    const byOperator: Record<string, number> = {};
    let total = 0;
    radioTypes.forEach(r => { byRadio[r] = 0; });
    operatorList.forEach(o => { byOperator[o] = 0; });
    // Sum only the cells where both radio AND operator are checked
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

  const toggleRadio = (r: string) => setTowerFilters({ ...towerFilters, radios: { ...towerFilters.radios, [r]: !towerFilters.radios[r] } });
  const toggleOperator = (o: string) => setTowerFilters({ ...towerFilters, operators: { ...towerFilters.operators, [o]: !towerFilters.operators[o] } });

  const radioDonut = useMemo(() => buildDonut(filteredStats.byRadio, radioColors), [filteredStats.byRadio]);
  const operatorDonut = useMemo(() => buildDonut(filteredStats.byOperator, operatorColors), [filteredStats.byOperator]);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapColorMode>('default');

  return (
    <div className="analytics-page">
      <div className="analytics-map">
        <div className="heatmap-mode-bar">
          <button className={`heatmap-mode-btn ${heatmapMode === 'default' ? 'active' : ''}`} onClick={() => setHeatmapMode('default')}>Default</button>
          <button className={`heatmap-mode-btn ${heatmapMode === 'radio' ? 'active' : ''}`} onClick={() => setHeatmapMode('radio')}>By Radio</button>
          <button className={`heatmap-mode-btn ${heatmapMode === 'operator' ? 'active' : ''}`} onClick={() => setHeatmapMode('operator')}>By Operator</button>
        </div>
        <MapView showHeatmap={true} showRoutes={true} heatmapColorMode={heatmapMode} />
      </div>
      <div className="analytics-panel">
        <h2 className="analytics-section-title">Network Analytics</h2>

        {/* Total Towers */}
        <div className="analytics-stat-card">
          <div className="analytics-stat-value">{totalStats.total.toLocaleString()}</div>
          <div className="analytics-stat-label">Total Towers in Dataset</div>
          <div className="analytics-stat-sub">
            All towers loaded · Used for heatmap &amp; routing
          </div>
        </div>

        {/* Filtered Count */}
        <div className="analytics-stat-card filtered-stat">
          <div className="analytics-stat-value" style={{ color: 'var(--accent)' }}>{filteredStats.total.toLocaleString()}</div>
          <div className="analytics-stat-label">Visible After Filters</div>
          <div className="analytics-stat-sub">
            {totalStats.total > 0 ? ((filteredStats.total / totalStats.total) * 100).toFixed(1) : 0}% of total
          </div>
        </div>

        {/* Radio Distribution Donut */}
        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Radio Distribution</h3>
          <Donut segments={radioDonut} centerText={filteredStats.total.toLocaleString()} centerSubtext="towers" />
          <div className="analytics-legend">
            {radioDonut.map((seg, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                <span>{seg.label}: {seg.count.toLocaleString()} ({seg.pct.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operator Distribution Donut */}
        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Operator Distribution</h3>
          <Donut segments={operatorDonut} centerText={filteredStats.total.toLocaleString()} centerSubtext="towers" />
          <div className="analytics-legend">
            {operatorDonut.map((seg, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                <span>{seg.label}: {seg.count.toLocaleString()} ({seg.pct.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown Table */}
        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Breakdown</h3>
          <table className="analytics-table">
            <thead><tr><th>Radio</th><th>Visible</th><th>Total</th></tr></thead>
            <tbody>
              {radioTypes.map(r => (
                <tr key={r}>
                  <td><span className="analytics-table radio-dot" style={{ backgroundColor: radioColors[r] || '#888' }} />{r}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{(filteredStats.byRadio[r] || 0).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)' }}>{(totalStats.byRadio[r] || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Radio Filters */}
        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Filter by Radio</h3>
          <div className="filter-toggles">
            {radioTypes.map(r => (
              <label key={r} className="filter-toggle">
                <input type="checkbox" checked={towerFilters.radios[r] ?? true} onChange={() => toggleRadio(r)} />
                <span className="legend-dot" style={{ backgroundColor: radioColors[r] || '#888' }} />
                <span>{r} ({(totalStats.byRadio[r] || 0).toLocaleString()})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Operator Filters */}
        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Filter by Operator</h3>
          <div className="filter-toggles">
            {operatorList.map(op => (
              <label key={op} className="filter-toggle">
                <input type="checkbox" checked={towerFilters.operators[op] ?? true} onChange={() => toggleOperator(op)} />
                <span className="legend-dot" style={{ backgroundColor: operatorColors[op] || '#888' }} />
                <span>{op} ({(totalStats.byOperator[op] || 0).toLocaleString()})</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
