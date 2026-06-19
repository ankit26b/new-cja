import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

const COLORS = { highly_engaged: '#16a34a', moderately_engaged: '#f59e0b', passive: '#dc2626' };
const STAGE_LABELS = { 0: 'Product', 1: 'Cart', 2: 'Checkout', 3: 'Payment' };

export default function EngagementScores() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('http://localhost:5000/api/engagement-scores?site_id=default_site', {
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

  const { distribution, average_score, scores_by_funnel_stage, top_sessions } = data;

  // Donut chart data
  const donutData = [
    { name: 'Highly Engaged', value: distribution.highly_engaged.count },
    { name: 'Moderately Engaged', value: distribution.moderately_engaged.count },
    { name: 'Passive', value: distribution.passive.count },
  ];
  const donutColors = [COLORS.highly_engaged, COLORS.moderately_engaged, COLORS.passive];

  // Bar chart data
  const barData = Object.entries(scores_by_funnel_stage)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([stage, avg]) => ({
      stage: STAGE_LABELS[stage] || `Stage ${stage}`,
      score: avg,
    }));

  // Category badge helper
  const Badge = ({ category }) => {
    const label = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <span style={{ ...styles.badge, background: COLORS[category] || '#94a3b8' }}>
        {label}
      </span>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Engagement Scores</h1>
          <p style={styles.subtitle}>Session-level engagement analysis across the funnel.</p>
        </div>
        <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
      </div>

      {/* Section 1 — Stat cards */}
      <div style={styles.cardRow}>
        <div style={{ ...styles.statCard, background: '#dcfce7', borderColor: '#16a34a' }}>
          <p style={styles.statLabel}>Highly Engaged</p>
          <p style={styles.statBig}>{distribution.highly_engaged.count}</p>
          <p style={styles.statPct}>{distribution.highly_engaged.percentage}%</p>
        </div>
        <div style={{ ...styles.statCard, background: '#fef3c7', borderColor: '#f59e0b' }}>
          <p style={styles.statLabel}>Moderately Engaged</p>
          <p style={styles.statBig}>{distribution.moderately_engaged.count}</p>
          <p style={styles.statPct}>{distribution.moderately_engaged.percentage}%</p>
        </div>
        <div style={{ ...styles.statCard, background: '#fee2e2', borderColor: '#dc2626' }}>
          <p style={styles.statLabel}>Passive</p>
          <p style={styles.statBig}>{distribution.passive.count}</p>
          <p style={styles.statPct}>{distribution.passive.percentage}%</p>
        </div>
      </div>

      {/* Section 2 — Donut chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.sectionTitle}>Engagement Distribution</h3>
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={130}
                paddingAngle={3}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={donutColors[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} sessions`, name]} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div style={styles.donutCenter}>
            <span style={styles.donutScore}>{average_score}</span>
            <span style={styles.donutLabel}>Avg Score</span>
          </div>
        </div>
      </div>

      {/* Section 3 — Bar chart by funnel stage */}
      <div style={{ ...styles.chartCard, marginTop: 24 }}>
        <h3 style={styles.sectionTitle}>Average Score by Funnel Stage</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="stage" tick={{ fontSize: 13, fill: '#475569' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => [v.toFixed(2), 'Avg Score']} />
            <Bar dataKey="score" fill="#667eea" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 4 — Top sessions table */}
      <div style={{ ...styles.chartCard, marginTop: 24 }}>
        <h3 style={styles.sectionTitle}>Top 20 Engaged Sessions</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Session ID</th>
                <th style={styles.th}>Score</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Clicks</th>
                <th style={styles.th}>Scroll Depth</th>
                <th style={styles.th}>Duration (s)</th>
              </tr>
            </thead>
            <tbody>
              {top_sessions.map((s, i) => (
                <tr key={i} style={i % 2 === 0 ? {} : { background: '#f8fafc' }}>
                  <td style={styles.td} title={s.session_id}>
                    {s.session_id.length > 12 ? s.session_id.slice(0, 12) + '…' : s.session_id}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{s.score}</td>
                  <td style={styles.td}><Badge category={s.category} /></td>
                  <td style={styles.td}>{s.total_clicks}</td>
                  <td style={styles.td}>{s.avg_scroll_depth}%</td>
                  <td style={styles.td}>{s.session_duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

  /* Section 1 — Stat cards */
  cardRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 },
  statCard: {
    borderRadius: 12, padding: '22px 26px', textAlign: 'center',
    border: '2px solid', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statLabel: { margin: 0, fontSize: 14, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  statBig: { margin: '8px 0 2px', fontSize: 40, fontWeight: 800 },
  statPct: { margin: 0, fontSize: 16, fontWeight: 600, color: '#64748b' },

  /* Charts */
  chartCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sectionTitle: { margin: '0 0 16px', fontSize: 18, fontWeight: 700 },

  /* Donut center */
  donutCenter: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center', pointerEvents: 'none',
  },
  donutScore: { display: 'block', fontSize: 32, fontWeight: 800, color: '#1e293b' },
  donutLabel: { display: 'block', fontSize: 13, color: '#64748b', fontWeight: 600, marginTop: 2 },

  /* Table */
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: {
    textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0',
    fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },

  /* Badge */
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 700, color: '#fff',
  },
};
