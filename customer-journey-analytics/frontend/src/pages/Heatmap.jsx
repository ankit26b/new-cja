import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";

export default function Heatmap() {

  const canvasRef = useRef(null);
  const [page, setPage] = useState("");
  const [pages, setPages] = useState([]);
  const { token } = useAuth();
  const { currentSiteId, loadingSites, availableSites } = useSite();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasData, setHasData] = useState(false);

  // Fetch available pages dynamically when site changes
  useEffect(() => {
    if (!token || !currentSiteId) { setPages([]); return; }
    fetch(`http://localhost:5000/api/analytics/pages?site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        setPages(Array.isArray(list) ? list : []);
        if (list.length > 0) setPage(list[0]);
      })
      .catch(() => setPages([]));
  }, [token, currentSiteId]);

  useEffect(() => {
    if (!token || !currentSiteId) {
      setLoading(true);
      setError('');
      setHasData(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setHasData(false);

    fetch(`http://localhost:5000/api/heatmap?page=${page}&site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const heat = simpleheat(canvas);

        const points = Array.isArray(data) ? data.map(point => [
          point.x,
          point.y,
          3
        ]) : [];

        setHasData(points.length > 0);

        heat.data(points);
        heat.max(5);
        heat.draw();

      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load heatmap data');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();

  }, [page, token, currentSiteId]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Heatmap Viewer</h1>
          {currentSiteId && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Site: <span style={{ fontWeight: 600, color: '#64748b' }}>
                {availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId}
              </span>
            </div>
          )}
        </div>
        <Link to="/dashboard" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>← Back to Dashboard</Link>
      </div>

      <div style={{ position: 'relative', display: 'inline-block', minWidth: '200px' }}>
        <select 
          value={page}
          onChange={(e) => setPage(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 40px 12px 16px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#1e293b',
            backgroundColor: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '10px',
            appearance: 'none',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.3s ease',
            fontFamily: 'inherit'
          }}
          onMouseOver={(e) => e.target.style.borderColor = '#cbd5e1'}
          onMouseOut={(e) => e.target.style.borderColor = '#e2e8f0'}
          onFocus={(e) => { e.target.style.borderColor = '#667eea'; e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'; }}
        >
          {pages.length === 0 && <option value="">Loading pages...</option>}
          {pages.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div style={{
          position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: '#64748b', display: 'flex', alignItems: 'center'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          marginTop: 20,
          border: "1px solid #ccc"
        }}
      />

      {loadingSites || loading ? <p style={{ color: '#64748b', marginTop: 12 }}>Loading heatmap...</p> : null}
      {!loadingSites && !loading && error ? <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p> : null}
      {!loadingSites && !loading && !error && !hasData ? (
        <p style={{ color: '#64748b', marginTop: 12 }}>No sessions recorded yet for this site.</p>
      ) : null}
    </div>
  );
}