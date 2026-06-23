import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { PanelSkeleton, PanelError, PanelEmpty } from '../components/PanelSkeleton';

const SENTIMENT_CONFIG = {
  positive: {
    label: 'Positive',
    color: '#22c55e',
    bg:    '#dcfce7',
    text:  '#16a34a',
    border:'#86efac',
    icon:  '😊',
  },
  neutral: {
    label: 'Neutral',
    color: '#f59e0b',
    bg:    '#fef3c7',
    text:  '#d97706',
    border:'#fcd34d',
    icon:  '😐',
  },
  negative: {
    label: 'Negative',
    color: '#ef4444',
    bg:    '#fee2e2',
    text:  '#dc2626',
    border:'#fca5a5',
    icon:  '😟',
  },
};

const ORDERED = ['positive', 'neutral', 'negative'];

// Custom tooltip for pie
function SentimentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: { sentiment } } = payload[0];
  const c = SENTIMENT_CONFIG[sentiment] || SENTIMENT_CONFIG.neutral;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <strong style={{ color: c.text }}>{name}</strong>
      <div style={{ marginTop: 4 }}><span style={{ color: '#64748b' }}>Entries: </span><strong>{value}</strong></div>
    </div>
  );
}

// Quote card for a single feedback snippet
function QuoteCard({ text, sentiment }) {
  const c = SENTIMENT_CONFIG[sentiment];
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 10,
      background: c.bg,
      border: `1px solid ${c.border}`,
      fontSize: 13,
      color: '#334155',
      lineHeight: 1.55,
      position: 'relative',
    }}>
      <span style={{ fontSize: 16, position: 'absolute', top: 10, left: 12, opacity: 0.6 }}>"</span>
      <span style={{ paddingLeft: 14, paddingRight: 14, display: 'block' }}>{text}</span>
      <span style={{ fontSize: 16, position: 'absolute', bottom: 8, right: 12, opacity: 0.6 }}>"</span>
    </div>
  );
}

export default function SentimentInsights() {
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
      `http://localhost:5000/api/analytics/sentiment-insights?site_id=${encodeURIComponent(currentSiteId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
    )
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => { if (!ctrl.signal.aborted) setData(d); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load sentiment data'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [token, currentSiteId]);

  const siteName = availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId || '';

  if (loading) return <PanelSkeleton />;
  if (error)   return <PanelError message={error} />;
  if (!data || data.total === 0) return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Sentiment Insights</h1>
          <p style={S.subtitle}>User feedback sentiment distribution and representative quotes.</p>
          {siteName && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>Site: <strong style={{ color: '#64748b' }}>{siteName}</strong></div>}
        </div>
        <Link to="/dashboard" style={S.backLink}>← Dashboard</Link>
      </div>
      <PanelEmpty message="No feedback entries yet for this site. Run the seed script to populate demo data." />
    </div>
  );

  const { counts, percentages, total, snippets } = data;

  const pieData = ORDERED.map(s => ({
    name: SENTIMENT_CONFIG[s].label,
    value: counts[s] ?? 0,
    sentiment: s,
  }));

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Sentiment Insights</h1>
          <p style={S.subtitle}>User feedback sentiment distribution and representative quotes.</p>
          {siteName && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Site: <strong style={{ color: '#64748b' }}>{siteName}</strong>
              <span style={{ marginLeft: 10, color: '#94a3b8' }}>· {total} feedback entries</span>
            </div>
          )}
        </div>
        <Link to="/dashboard" style={S.backLink}>← Dashboard</Link>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div style={S.cardRow}>
        {ORDERED.map(key => {
          const c = SENTIMENT_CONFIG[key];
          return (
            <div key={key} style={{ ...S.statCard, background: c.bg, borderColor: c.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: c.text, lineHeight: 1 }}>
                {counts[key] ?? 0}
              </div>
              <div style={{ fontSize: 13, color: c.text, opacity: 0.75, marginTop: 6 }}>
                {percentages[key] ?? 0}% of feedback
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pie chart ───────────────────────────────────────────── */}
      <div style={S.chartCard}>
        <h3 style={S.sectionTitle}>Sentiment Distribution</h3>
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
              label={({ name, percent }) =>
                percent > 0.03 ? `${(percent * 100).toFixed(1)}%` : ''
              }
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={SENTIMENT_CONFIG[ORDERED[i]].color} />
              ))}
            </Pie>
            <Tooltip content={<SentimentTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ── Representative quotes ─────────────────────────────────── */}
      <div style={S.quotesSection}>
        <h3 style={S.sectionTitle}>Representative Feedback Quotes</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
          2–3 representative quotes per sentiment category from real user feedback entries.
        </p>
        <div style={S.quotesGrid}>
          {ORDERED.map(key => {
            const c = SENTIMENT_CONFIG[key];
            const quotes = (snippets?.[key] ?? []).slice(0, 3);
            return (
              <div key={key} style={S.quotesCol}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{c.label}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
                    {counts[key] ?? 0} entries
                  </span>
                </div>
                {quotes.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0' }}>
                    No feedback in this category.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {quotes.map((q, i) => (
                      <QuoteCard key={i} text={q} sentiment={key} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
  cardRow:  { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 },
  statCard: { border: '1px solid', borderRadius: 12, padding: '20px 22px' },
  chartCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  sectionTitle: { margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0f172a' },
  quotesSection: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
    padding: '22px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginTop: 24,
  },
  quotesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24,
  },
  quotesCol: {},
};
