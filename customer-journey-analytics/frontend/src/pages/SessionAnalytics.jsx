import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { PanelSkeleton, PanelError, PanelEmpty } from '../components/PanelSkeleton';

const PAGE_SIZE = 20;

// Site-specific funnel stage labels so reviewers see meaningful names, not just numbers
const SITE_STAGE_LABELS = {
  ecommerce_001:    ['Product Page', 'Cart', 'Checkout', 'Order Complete'],
  demo_bookstore_002: ['Book Page', 'Cart', 'Checkout', 'Order Confirmed'],
};
const DEFAULT_STAGE_LABELS = ['Stage 0', 'Stage 1', 'Stage 2', 'Stage 3'];

function stageLabel(siteId, stageNum) {
  const labels = SITE_STAGE_LABELS[siteId] || DEFAULT_STAGE_LABELS;
  if (stageNum == null || stageNum < 0) return '—';
  return labels[stageNum] ?? `Stage ${stageNum}`;
}

function fmtDuration(secs) {
  if (!secs && secs !== 0) return '—';
  const s = Math.round(Number(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return `${m}m ${String(rem).padStart(2, '0')}s`;
}

function fmtTs(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return ts; }
}

const SORT_COLS = [
  { key: 'timestamp',        label: 'Time' },
  { key: 'duration',         label: 'Duration' },
  { key: 'pages_visited',    label: 'Pages' },
  { key: 'max_funnel_stage', label: 'Stage' },
  { key: 'scroll_depth',     label: 'Scroll' },
];

// Risk tier colour derived from max_funnel_stage:
// stage 0 = high risk, 1-2 = medium, 3 = low
function stageTierStyle(stage) {
  const n = Number(stage);
  if (n >= 3) return { color: '#16a34a', background: '#dcfce7' };
  if (n >= 1) return { color: '#d97706', background: '#fef3c7' };
  return { color: '#dc2626', background: '#fee2e2' };
}

// ── Session Detail Drawer ─────────────────────────────────────────────────────
function SessionDetail({ sessionId, siteId, token, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!sessionId || !siteId || !token) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    setDetail(null);

    fetch(
      `http://localhost:5000/api/analytics/sessions/${encodeURIComponent(sessionId)}?site_id=${encodeURIComponent(siteId)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
    )
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => { if (!ctrl.signal.aborted) setDetail(d); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load session'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [sessionId, siteId, token]);

  // Derive page path from events
  const pageViews = detail?.events?.filter(e => e.event_type === 'page_view') ?? [];
  const uniquePages = [...new Set(pageViews.map(e => e.page_url ?? '—'))];

  return (
    <div style={dS.overlay}>
      <div style={dS.drawer}>
        <div style={dS.drawerHead}>
          <div>
            <h3 style={dS.drawerTitle}>Session Detail</h3>
            <p style={dS.drawerSub} title={sessionId}>{sessionId}</p>
          </div>
          <button onClick={onClose} style={dS.closeBtn} aria-label="Close">✕</button>
        </div>

        {loading && (
          <div style={{ padding: '24px 0' }}>
            {[60, 90, 75].map((w, i) => (
              <div key={i} className="cja-skeleton" style={{ width: `${w}%`, height: 14, marginBottom: 12 }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="cja-panel-error">{error}</div>
        )}

        {!loading && !error && detail && (
          <>
            {/* Stat row */}
            <div style={dS.statGrid}>
              <Stat label="Duration"    value={fmtDuration(detail.session?.duration)} />
              <Stat label="Pages"       value={detail.session?.pages_visited ?? detail.session?.total_pages ?? '—'} />
              <Stat label="Max Stage"   value={stageLabel(siteId, detail.session?.max_funnel_stage)} />
              <Stat label="Scroll"      value={detail.session?.avg_scroll_depth != null ? `${Math.round(detail.session.avg_scroll_depth)}%` : '—'} />
              <Stat label="Clicks"      value={detail.session?.total_clicks ?? '—'} />
              <Stat label="Started"     value={fmtTs(detail.session?.start_time)} />
            </div>

            {/* Page journey */}
            <div style={dS.section}>
              <p style={dS.sectionTitle}>Page Journey</p>
              {uniquePages.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94a3b8' }}>No page view events recorded.</p>
              ) : (
                <div style={dS.pathRow}>
                  {uniquePages.map((p, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={dS.pageBadge}>{p}</span>
                      {i < uniquePages.length - 1 && <span style={{ color: '#94a3b8', fontSize: 13 }}>→</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Event log (up to 30) */}
            <div style={dS.section}>
              <p style={dS.sectionTitle}>Event Log <span style={{ fontWeight: 400, color: '#94a3b8' }}>({detail.events?.length ?? 0} total, showing first 30)</span></p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Type', 'Page', 'x', 'y', 'Scroll %', 'Time'].map(h => (
                        <th key={h} style={dS.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.events ?? []).slice(0, 30).map((ev, i) => (
                      <tr key={i} style={i % 2 === 0 ? {} : { background: '#f8fafc' }}>
                        <td style={dS.td}><span style={evBadge(ev.event_type)}>{ev.event_type ?? '—'}</span></td>
                        <td style={{ ...dS.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.page_url}>{ev.page_url ?? '—'}</td>
                        <td style={dS.td}>{ev.x ?? '—'}</td>
                        <td style={dS.td}>{ev.y ?? '—'}</td>
                        <td style={dS.td}>{ev.scroll_depth != null ? `${ev.scroll_depth}%` : '—'}</td>
                        <td style={dS.td}>{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={dS.statCard}>
      <span style={dS.statLabel}>{label}</span>
      <span style={dS.statValue}>{value}</span>
    </div>
  );
}

function evBadge(type) {
  const colours = {
    page_view:  { color: '#1e40af', background: '#dbeafe' },
    click:      { color: '#c2410c', background: '#ffedd5' },
    scroll:     { color: '#6d28d9', background: '#ede9fe' },
    mouse_move: { color: '#475569', background: '#f1f5f9' },
    mousemove:  { color: '#475569', background: '#f1f5f9' },
  };
  const c = colours[type] || { color: '#475569', background: '#f1f5f9' };
  return { fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10, ...c };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SessionAnalytics() {
  const { token } = useAuth();
  const { currentSiteId, availableSites } = useSite();

  const [sessions, setSessions]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [sortBy, setSortBy]       = useState('timestamp');
  const [sortDir, setSortDir]     = useState('desc');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // Reset to page 1 and clear selection when site changes
  useEffect(() => {
    setPage(1);
    setSessions([]);
    setTotal(0);
    setSelectedId(null);
    setError('');
  }, [currentSiteId]);

  const fetchSessions = useCallback(() => {
    if (!token || !currentSiteId) { setLoading(true); return; }

    const ctrl = new AbortController();
    setLoading(true);
    setError('');

    const url = new URL('http://localhost:5000/api/analytics/sessions');
    url.searchParams.set('site_id',  currentSiteId);
    url.searchParams.set('page',     page);
    url.searchParams.set('limit',    PAGE_SIZE);
    url.searchParams.set('sort_by',  sortBy);
    url.searchParams.set('sort_dir', sortDir);

    fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => {
        if (!ctrl.signal.aborted) {
          setSessions(Array.isArray(d.sessions) ? d.sessions : []);
          setTotal(d.total ?? 0);
        }
      })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Failed to load sessions'); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });

    return () => ctrl.abort();
  }, [token, currentSiteId, page, sortBy, sortDir]);

  useEffect(() => {
    const cleanup = fetchSessions();
    return cleanup;
  }, [fetchSessions]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const siteName = availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId || '';

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Session Analytics</h1>
          <p style={S.subtitle}>Browse individual sessions — click any row to inspect the full event log.</p>
          {siteName && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Site: <strong style={{ color: '#64748b' }}>{siteName}</strong>
              {total > 0 && <span style={{ marginLeft: 10, color: '#94a3b8' }}>· {total} sessions total</span>}
            </div>
          )}
        </div>
        <Link to="/dashboard" style={S.backLink}>← Dashboard</Link>
      </div>

      {/* Loading */}
      {loading && <PanelSkeleton rows={5} />}

      {/* Error */}
      {!loading && error && <PanelError message={error} />}

      {/* Empty */}
      {!loading && !error && sessions.length === 0 && (
        <PanelEmpty message="No sessions recorded yet for this site." />
      )}

      {/* Table */}
      {!loading && !error && sessions.length > 0 && (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Session ID</th>
                  {SORT_COLS.map(col => (
                    <th
                      key={col.key}
                      style={{ ...S.th, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      {sortBy === col.key && (
                        <span style={{ marginLeft: 4, fontSize: 11 }}>
                          {sortDir === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </th>
                  ))}
                  <th style={S.th}>Funnel Stage</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const isSelected = selectedId === s.session_id;
                  return (
                    <tr
                      key={s.session_id}
                      onClick={() => setSelectedId(isSelected ? null : s.session_id)}
                      style={{
                        ...(i % 2 === 0 ? {} : { background: '#f8fafc' }),
                        cursor: 'pointer',
                        ...(isSelected ? { outline: '2px solid #667eea', outlineOffset: -2 } : {}),
                      }}
                    >
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }} title={s.session_id}>
                        {s.session_id.length > 22 ? s.session_id.slice(0, 20) + '…' : s.session_id}
                      </td>
                      <td style={S.td}>{fmtTs(s.start_time)}</td>
                      <td style={S.td}>{fmtDuration(s.duration)}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{s.pages_visited ?? s.total_pages ?? '—'}</td>
                      <td style={S.td}>
                        <span style={{ ...S.stageBadge, ...stageTierStyle(s.max_funnel_stage) }}>
                          {stageLabel(currentSiteId, s.max_funnel_stage)}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {s.avg_scroll_depth != null ? `${Math.round(s.avg_scroll_depth)}%` : '—'}
                      </td>
                      <td style={S.td}>
                        {s.max_funnel_stage != null
                          ? `${s.max_funnel_stage} / 3`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={S.pagRow}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Page {page} of {totalPages} &nbsp;·&nbsp; {total} sessions
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...S.pagBtn, opacity: page === 1 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ ...S.pagBtn, opacity: page === totalPages ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session detail drawer */}
      {selectedId && (
        <SessionDetail
          sessionId={selectedId}
          siteId={currentSiteId}
          token={token}
          onClose={() => setSelectedId(null)}
        />
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
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  title:   { margin: 0, fontSize: 28, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 15 },
  backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '12px 14px', textAlign: 'left', fontWeight: 600,
    fontSize: 12, color: '#64748b', background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
  },
  td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  stageBadge: { fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10 },
  pagRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderTop: '1px solid #f1f5f9',
  },
  pagBtn: {
    padding: '7px 14px', fontSize: 13, fontWeight: 600,
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 7, cursor: 'pointer', color: '#475569',
  },
};

const dS = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    zIndex: 9999, display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: 600, maxWidth: '95vw', height: '100vh', overflowY: 'auto',
    background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    padding: '28px 28px 48px',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  },
  drawerHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  drawerTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' },
  drawerSub:   { margin: '4px 0 0', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' },
  closeBtn: {
    background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#475569', flexShrink: 0,
  },
  statGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 },
  statCard:    { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' },
  statLabel:   { display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
  statValue:   { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  section:     { marginTop: 24 },
  sectionTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#334155' },
  pathRow:     { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pageBadge:   { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#dbeafe', color: '#1e40af' },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '7px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontSize: 12, color: '#334155' },
};
