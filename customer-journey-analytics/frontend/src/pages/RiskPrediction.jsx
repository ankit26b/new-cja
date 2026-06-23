import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { PanelSkeleton, PanelError, PanelEmpty } from '../components/PanelSkeleton';

// Risk tier colour palette
const RISK_COLORS = {
  high:   { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', dot: '#ef4444' },
  medium: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d', dot: '#f59e0b' },
  low:    { bg: '#dcfce7', text: '#16a34a', border: '#86efac', dot: '#22c55e' },
};

const RISK_PIE_COLORS = [RISK_COLORS.high.dot, RISK_COLORS.medium.dot, RISK_COLORS.low.dot];

const RISK_LABELS = { high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk' };

// Custom tooltip for pie chart
function RiskTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: { tier } } = payload[0];
  const c = RISK_COLORS[tier] || RISK_COLORS.medium;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <strong style={{ color: c.text }}>{name}</strong>
      <div style={{ marginTop: 4 }}><span style={{ color: '#64748b' }}>Sessions: </span><strong>{value}</strong></div>
    </div>
  );
}

export default function RiskPrediction() {
  const { token } = useAuth();
  const { currentSiteId, availableSites } = useSite();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!token || !currentSiteId) {
      setData(null); setLoading(true); setError('');
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    setData(null);

    fetch(
      `http://localhost:5000/api/analytics/risk-distribution?site_id=${encodeURIComponent(currentSiteId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
    )
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => { if (!ctrl.signal.aborted) setData(d); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load risk data'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [token, currentSiteId]);

  const siteName = availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId || '';

  if (loading) return <PanelSkeleton />;
  if (error)   return <PanelError message={error} />;
  if (!data || data.total === 0) return <PanelEmpty message="No session data yet for this site." />;

  const { distribution, sessions, total } = data;

  const pieData = ['high', 'medium', 'low'].map(tier => ({
    name:  RISK_LABELS[tier],
    value: distribution[tier] ?? 0,
    tier,
  }));

  // Top 10 high-risk sessions for the table
  const topRisk = sessions.filter(s => s.risk_tier === 'high').slice(0, 10);
  // All sessions classified as having null/unknown tier (safety check)
  const unknownCount = sessions.filter(s => !s.risk_tier).length;

  function pct(n) {
    return total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Risk Prediction</h1>
          <p style={S.subtitle}>
            ML-computed drop-off probability for each session.
          </p>
          {siteName && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Site: <strong style={{ color: '#64748b' }}>{siteName}</strong>
              <span style={{ marginLeft: 10, color: '#94a3b8' }}>· {total} sessions scored</span>
            </div>
          )}
        </div>
        <Link to="/dashboard" style={S.backLink}>← Dashboard</Link>
      </div>

      {/* ── What this panel means ─────────────────────────────────── */}
      <div style={S.explainBox}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: '#4f46e5' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          <strong>What does this mean?</strong> Each session is scored 0–1 based on engagement signals
          (scroll depth, duration, clicks, pages visited, funnel depth). A higher score means the session
          is predicted to <em>abandon before completing checkout</em>.&nbsp;
          <strong style={{ color: RISK_COLORS.high.text }}>High (≥ 0.67)</strong> = likely to drop off,&nbsp;
          <strong style={{ color: RISK_COLORS.medium.text }}>Medium (0.40–0.67)</strong> = at risk,&nbsp;
          <strong style={{ color: RISK_COLORS.low.text }}>Low (&lt; 0.40)</strong> = likely to convert.
        </span>
      </div>

      {unknownCount > 0 && (
        <div style={{ ...S.explainBox, background: '#fef9c3', borderColor: '#fde68a', color: '#92400e', marginTop: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>{unknownCount} session(s) could not be scored (missing feature data) and are excluded.</span>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div style={S.cardRow}>
        {['high', 'medium', 'low'].map(tier => {
          const c = RISK_COLORS[tier];
          const count = distribution[tier] ?? 0;
          return (
            <div key={tier} style={{ ...S.statCard, background: c.bg, borderColor: c.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{RISK_LABELS[tier]}</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: c.text, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 13, color: c.text, opacity: 0.75, marginTop: 6 }}>{pct(count)}% of sessions</div>
            </div>
          );
        })}
      </div>

      {/* ── Pie chart ───────────────────────────────────────────── */}
      <div style={S.chartCard}>
        <h3 style={S.sectionTitle}>Risk Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              paddingAngle={3}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={RISK_PIE_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={<RiskTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ── Top high-risk sessions table ─────────────────────────── */}
      {topRisk.length > 0 && (
        <div style={{ ...S.chartCard, marginTop: 24 }}>
          <h3 style={S.sectionTitle}>
            Top High-Risk Sessions
            <span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
              (highest predicted drop-off probability)
            </span>
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Session ID', 'Risk Score', 'Risk Tier'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRisk.map((s, i) => {
                  const c = RISK_COLORS[s.risk_tier] || RISK_COLORS.medium;
                  return (
                    <tr key={i} style={i % 2 === 0 ? {} : { background: '#f8fafc' }}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }} title={s.session_id}>
                        {s.session_id?.length > 28 ? s.session_id.slice(0, 26) + '…' : (s.session_id ?? '—')}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Progress bar */}
                          <div style={{ width: 80, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${Math.round(s.risk_score * 100)}%`, height: '100%', background: c.dot, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
                            {(s.risk_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: c.bg, color: c.text }}>
                          {RISK_LABELS[s.risk_tier]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    maxWidth: 1100, margin: '0 auto', padding: '32px 24px',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    color: '#1e293b',
  },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title:    { margin: 0, fontSize: 28, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 15 },
  backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' },
  explainBox: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '12px 16px', background: '#eef2ff',
    border: '1px solid #c7d2fe', borderRadius: 10,
    fontSize: 13, color: '#3730a3', lineHeight: 1.5, marginBottom: 24,
  },
  cardRow:  { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 },
  statCard: { border: '1px solid', borderRadius: 12, padding: '20px 22px' },
  chartCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f172a' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '10px 14px', textAlign: 'left', fontWeight: 600,
    fontSize: 12, color: '#64748b', background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
};
