'use client';
import dynamic from 'next/dynamic';
import { useRouting } from '@/context/RoutingContext';
import { useEffect, useState, useMemo } from 'react';

const MapView = dynamic(() => import('@/components/map/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div style={{ width: '100%', height: '100%', background: 'var(--bg-base)' }} />,
});

const radioColors: Record<string, string> = {
  '5G': '#4edea3',
  '4G': '#6e7fff',
};

export default function AnalyticsPage() {
  const { heatmapData, fetchHeatmap } = useRouting();
  const [filters, setFilters] = useState({ '5G': true, '4G': true });

  useEffect(() => {
    if (heatmapData.length === 0) { fetchHeatmap(); }
  }, [heatmapData.length, fetchHeatmap]);

  const towerStats = useMemo(() => {
    let count5G = 0, count4G = 0;
    for (const [, , intensity] of heatmapData) {
      if (intensity >= 0.9) count5G++;
      else count4G++;
    }
    return { total: heatmapData.length, count5G, count4G };
  }, [heatmapData]);

  const filteredHeatmap = useMemo(() => {
    return heatmapData.filter(([, , intensity]) => {
      if (intensity >= 0.9) return filters['5G'];
      return filters['4G'];
    });
  }, [heatmapData, filters]);

  const toggleFilter = (radio: string) => {
    setFilters(f => ({ ...f, [radio]: !f[radio as keyof typeof f] }));
  };

  const donutSegments = useMemo(() => {
    const total = towerStats.total || 1;
    const segments = [
      { label: '5G', count: towerStats.count5G, color: radioColors['5G'] },
      { label: '4G', count: towerStats.count4G, color: radioColors['4G'] },
    ];
    let offset = 0;
    return segments.map(seg => {
      const pct = (seg.count / total) * 100;
      const dashArray = `${pct} ${100 - pct}`;
      const dashOffset = -offset;
      offset += pct;
      return { ...seg, pct, dashArray, dashOffset };
    });
  }, [towerStats]);

  return (
    <div className="analytics-page">
      <div className="analytics-map">
        {/* Pass filtered heatmap and show routes on top */}
        <MapView showHeatmap={true} showRoutes={true} className="" />
      </div>
      <div className="analytics-panel">
        <div><h2 className="analytics-section-title">Network Analytics</h2></div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-value">{towerStats.total.toLocaleString()}</div>
          <div className="analytics-stat-label">Total Towers Loaded</div>
        </div>

        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Distribution</h3>
          <div className="analytics-donut">
            <svg width="140" height="140" viewBox="0 0 42 42">
              <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              {donutSegments.map((seg, i) => (
                <circle key={i} cx="21" cy="21" r="15.9" fill="transparent" stroke={seg.color}
                  strokeWidth="5" strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset}
                  strokeLinecap="round" transform="rotate(-90 21 21)"
                  style={{ transition: 'all 0.6s ease' }} />
              ))}
              <text x="21" y="20" textAnchor="middle" fill="var(--text-primary)" fontSize="5"
                fontFamily="var(--font-display)" fontWeight="700">{towerStats.total.toLocaleString()}</text>
              <text x="21" y="25" textAnchor="middle" fill="var(--text-muted)" fontSize="2.5"
                fontFamily="var(--font-body)">towers</text>
            </svg>
          </div>
          <div className="analytics-legend">
            {donutSegments.map((seg, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                <span>{seg.label}: {seg.count.toLocaleString()} ({seg.pct.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Breakdown</h3>
          <table className="analytics-table">
            <thead><tr><th>Radio</th><th>Count</th><th>Share</th></tr></thead>
            <tbody>
              {[
                { radio: '5G', count: towerStats.count5G, color: radioColors['5G'] },
                { radio: '4G', count: towerStats.count4G, color: radioColors['4G'] },
              ].map(row => (
                <tr key={row.radio}>
                  <td><span className="analytics-table radio-dot" style={{ backgroundColor: row.color }} />{row.radio}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{row.count.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                    {towerStats.total > 0 ? ((row.count / towerStats.total) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="analytics-section-title" style={{ fontSize: '14px' }}>Filter Heatmap</h3>
          <div className="filter-toggles">
            {(['5G', '4G'] as const).map(radio => (
              <label key={radio} className="filter-toggle">
                <input type="checkbox" checked={filters[radio]} onChange={() => toggleFilter(radio)} />
                <span className="legend-dot" style={{ backgroundColor: radioColors[radio] }} />
                <span>{radio} Towers</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
