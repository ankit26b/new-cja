import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BADGE_COLORS = {
  '/':         { bg: '#e2e8f0', text: '#475569' },
  '/product':  { bg: '#dbeafe', text: '#1e40af' },
  '/cart':     { bg: '#ffedd5', text: '#c2410c' },
  '/checkout': { bg: '#ede9fe', text: '#6d28d9' },
  '/payment':  { bg: '#dcfce7', text: '#16a34a' },
};

function badgeFor(step) {
  const trimmed = step.trim();
  const colors = BADGE_COLORS[trimmed] || { bg: '#f1f5f9', text: '#334155' };
  const label = trimmed === '/' ? 'Home' : trimmed.replace('/', '').replace(/^\w/, c => c.toUpperCase());
  return (
    <span
      key={trimmed + Math.random()}
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.text,
        marginRight: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

const FILTERS = ['All', 'Converted', 'Drop-off'];

export default function NavPaths() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('http://localhost:5000/api/nav-paths?limit=50', {
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

  if (loading) return <div style={styles.container}><p style={{ textAlign: 'center', marginTop: 60 }}>Loading…</p></div>;
  if (error) return <div style={styles.container}><p style={{ color: '#dc2626', textAlign: 'center', marginTop: 60 }}>{error}</p></div>;
  if (!data) return null;

  const { paths, summary } = data;

  const totalSessions = paths.reduce((s, p) => s + p.session_count, 0);

  const filtered = paths.filter(p => {
    if (filter === 'Converted') return p.converted;
    if (filter === 'Drop-off') return !p.converted;
    return true;
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Navigation Paths</h1>
          <p style={styles.subtitle}>Most common journeys users take through your site.</p>
        </div>
        <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardRow}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Unique Paths</span>
          <span style={styles.cardValue}>{summary.total_unique_paths}</span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Most Common Path</span>
          <span style={{ ...styles.cardValue, fontSize: 16, wordBreak: 'break-word' }}>
            {summary.most_common_path
              ? summary.most_common_path.length > 60
                ? summary.most_common_path.slice(0, 57) + '…'
                : summary.most_common_path
              : '—'}
          </span>
        </div>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Conversion Rate</span>
          <span style={{ ...styles.cardValue, color: '#16a34a' }}>{summary.conversion_rate}%</span>
        </div>
      </div>

      {/* Filter Toggle */}
      <div style={styles.filterRow}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterBtn,
              ...(filter === f ? styles.filterBtnActive : {}),
            }}
          >
            {f === 'All' ? 'Show All Paths' : f === 'Converted' ? 'Show Converted Only' : 'Show Drop-off Only'}
          </button>
        ))}
      </div>

      {/* Paths Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Rank', 'Path', 'Sessions', 'Converted', 'Share'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const steps = p.path.split(' → ');
              const share = totalSessions > 0
                ? ((p.session_count / totalSessions) * 100).toFixed(1)
                : '0.0';
              return (
                <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  <td style={styles.td}>{i + 1}</td>
                  <td style={{ ...styles.td, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                    {steps.map((step, si) => (
                      <span key={si} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {badgeFor(step)}
                        {si < steps.length - 1 && <span style={{ margin: '0 2px', color: '#94a3b8', fontSize: 13 }}>→</span>}
                      </span>
                    ))}
                  </td>
                  <td style={styles.td}>{p.session_count}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {p.converted
                      ? <span style={{ color: '#16a34a', fontSize: 18 }}>✓</span>
                      : <span style={{ color: '#dc2626', fontSize: 18 }}>✗</span>}
                  </td>
                  <td style={styles.td}>{share}%</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8' }}>No paths match the current filter.</td></tr>
            )}
          </tbody>
        </table>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: { margin: 0, fontSize: 28, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 15 },
  backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' },

  /* Summary cards */
  cardRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardLabel: { fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 26, fontWeight: 700 },

  /* Filter */
  filterRow: { display: 'flex', gap: 8, marginBottom: 20 },
  filterBtn: {
    padding: '8px 18px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    color: '#475569',
    transition: 'all .15s',
  },
  filterBtnActive: {
    background: '#667eea',
    color: '#fff',
    borderColor: '#667eea',
  },

  /* Table */
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '2px solid #e2e8f0',
    whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', fontSize: 14, borderBottom: '1px solid #f1f5f9' },
  rowEven: { background: '#fff' },
  rowOdd: { background: '#f8fafc' },
};
