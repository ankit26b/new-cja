import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ConversionInfluencer() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('http://localhost:5000/api/conversion-influence?site_id=default_site', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return <div style={styles.container}><p style={{ textAlign: 'center', marginTop: 60 }}>Loading…</p></div>;
  if (error)
    return <div style={styles.container}><p style={{ color: '#dc2626', textAlign: 'center', marginTop: 60 }}>{error}</p></div>;
  if (!data) return null;

  const { converted, dropped, insights } = data;

  // ---- Radar chart data (normalized 0-100) ----
  const radarMetrics = [
    { label: 'Clicks',     cVal: converted.avg_clicks,   dVal: dropped.avg_clicks },
    { label: 'Scroll %',   cVal: converted.avg_scroll,   dVal: dropped.avg_scroll },
    { label: 'Duration',   cVal: converted.avg_duration,  dVal: dropped.avg_duration },
    { label: 'Pages',      cVal: converted.avg_pages,     dVal: dropped.avg_pages },
  ];

  const radarData = radarMetrics.map(m => {
    const max = Math.max(m.cVal, m.dVal, 1);
    return {
      metric: m.label,
      Converted: parseFloat(((m.cVal / max) * 100).toFixed(1)),
      Dropped:   parseFloat(((m.dVal / max) * 100).toFixed(1)),
    };
  });

  // ---- Stat card helper ----
  const StatRow = ({ label, value }) => (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Conversion Influencer</h1>
          <p style={styles.subtitle}>Compare behaviour between users who converted and those who dropped off.</p>
        </div>
        <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
      </div>

      {/* Section 1 — Side-by-side stat cards */}
      <div style={styles.cardGrid}>
        {/* Converted column */}
        <div style={{ ...styles.card, borderTop: '4px solid #16a34a' }}>
          <h3 style={{ ...styles.cardTitle, color: '#16a34a' }}>Converted Users</h3>
          <StatRow label="Session Count" value={converted.count} />
          <StatRow label="Avg Clicks" value={converted.avg_clicks} />
          <StatRow label="Avg Scroll Depth" value={`${converted.avg_scroll}%`} />
          <StatRow label="Avg Duration" value={fmtDuration(converted.avg_duration)} />
          <StatRow label="Avg Pages Visited" value={converted.avg_pages} />
        </div>

        {/* Dropped column */}
        <div style={{ ...styles.card, borderTop: '4px solid #dc2626' }}>
          <h3 style={{ ...styles.cardTitle, color: '#dc2626' }}>Dropped Users</h3>
          <StatRow label="Session Count" value={dropped.count} />
          <StatRow label="Avg Clicks" value={dropped.avg_clicks} />
          <StatRow label="Avg Scroll Depth" value={`${dropped.avg_scroll}%`} />
          <StatRow label="Avg Duration" value={fmtDuration(dropped.avg_duration)} />
          <StatRow label="Avg Pages Visited" value={dropped.avg_pages} />
        </div>
      </div>

      {/* Section 2 — Radar chart */}
      <div style={styles.chartCard}>
        <h3 style={{...styles.sectionTitle, color: '#0c59be'}}>Behavioural Comparison</h3>
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData} outerRadius="75%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 13, fill: '#475569' }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Radar name="Converted" dataKey="Converted" stroke="#16a34a" fill="#16a34a" fillOpacity={0.25} />
            <Radar name="Dropped"   dataKey="Dropped"   stroke="#dc2626" fill="#dc2626" fillOpacity={0.15} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3 — Insights */}
      {insights && insights.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={styles.sectionTitle}>Key Behavioral Differences</h3>
          <div style={styles.insightList}>
            {insights.map((text, i) => (
              <div key={i} style={styles.insightCard}>
                <span style={styles.insightIcon}>💡</span>
                <span style={styles.insightText}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#1e293b',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28,
  },
  title: { margin: 0, fontSize: 28, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 15 },
  backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' },

  /* Stat cards */
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardTitle: { margin: '0 0 16px', fontSize: 17, fontWeight: 700 },
  statRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  statLabel: { fontSize: 14, color: '#64748b', fontWeight: 500 },
  statValue: { fontSize: 15, fontWeight: 700 },

  /* Radar chart */
  chartCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sectionTitle: { margin: '0 0 16px', fontSize: 18, fontWeight: 700 },

  /* Insights */
  insightList: { display: 'flex', flexDirection: 'column', gap: 12 },
  insightCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10,
    padding: '14px 18px',
  },
  insightIcon: { fontSize: 22, lineHeight: 1, flexShrink: 0 },
  insightText: { fontSize: 15, fontWeight: 500, color: '#92400e', lineHeight: 1.5 },
};
