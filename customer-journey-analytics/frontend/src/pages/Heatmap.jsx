import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";

// Reference viewport dimensions used during data capture (matches seed.js clamp values)
const REF_W = 1280;
const REF_H = 800;

export default function Heatmap() {

  const canvasRef   = useRef(null);
  const containerRef = useRef(null);
  const [page, setPage]   = useState("");
  const [pages, setPages] = useState([]);
  const { token } = useAuth();
  const { currentSiteId, loadingSites, availableSites } = useSite();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [hasData, setHasData]   = useState(false);

  // When site changes, reset page selection so stale page from old site is cleared
  useEffect(() => {
    setPage('');
    setPages([]);
    setHasData(false);
    setError('');
  }, [currentSiteId]);

  // Fetch available pages dynamically when site changes
  useEffect(() => {
    if (!token || !currentSiteId) { setPages([]); return; }
    fetch(`http://localhost:5000/api/analytics/pages?site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setPages(arr);
        // Reset to first page of the NEW site
        setPage(arr.length > 0 ? arr[0] : '');
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

        // Scale canvas to fill its container while preserving the 1280×800 aspect ratio.
        // All recorded coordinates are then scaled proportionally so positions remain accurate.
        const containerW = (containerRef.current?.clientWidth || 900);
        const canvasW = Math.min(containerW, REF_W);
        const canvasH = Math.round(canvasW * (REF_H / REF_W));
        canvas.width  = canvasW;
        canvas.height = canvasH;

        const scaleX = canvasW / REF_W;
        const scaleY = canvasH / REF_H;

        const points = Array.isArray(data) ? data.map(point => [
          point.x * scaleX,
          point.y * scaleY,
          1
        ]) : [];

        setHasData(points.length > 0);

        const heat = simpleheat(canvas);
        heat.data(points);
        heat.radius(Math.round(25 * scaleX), Math.round(35 * scaleX));
        heat.max(points.length > 50 ? 6 : 3);
        heat.draw(0.06);

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
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px', fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", color:'#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Heatmap Viewer</h1>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: '#64748b' }}>Click &amp; cursor density heatmap — coordinates scaled to reference viewport (1280&times;800).</p>
          {currentSiteId && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              Site: <span style={{ fontWeight: 600, color: '#64748b' }}>
                {availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId}
              </span>
            </div>
          )}
        </div>
        <Link to="/dashboard" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600, whiteSpace:'nowrap' }}>← Dashboard</Link>
      </div>

      {/* Page selector */}
      <div style={{ position: 'relative', display: 'inline-block', minWidth: '200px', marginBottom: 8 }}>
        <select 
          value={page}
          onChange={(e) => setPage(e.target.value)}
          style={{
            width: '100%', padding: '12px 40px 12px 16px', fontSize: '15px',
            fontWeight: '600', color: '#1e293b', backgroundColor: '#ffffff',
            border: '2px solid #e2e8f0', borderRadius: '10px', appearance: 'none',
            outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#667eea'; e.target.style.boxShadow = '0 0 0 3px rgba(102,126,234,0.2)'; }}
          onBlur={(e)  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
        >
          {pages.length === 0 && <option value="">Loading pages…</option>}
          {pages.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#64748b' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Loading skeleton in place of canvas */}
      {(loadingSites || loading) && (
        <div className="cja-skeleton" style={{ width:'100%', height:400, borderRadius:8, marginTop:12 }} />
      )}

      {/* Error */}
      {!loadingSites && !loading && error && (
        <div className="cja-panel-error" style={{ marginTop:12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Empty */}
      {!loadingSites && !loading && !error && !hasData && (
        <div className="cja-panel-empty" style={{ marginTop:12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
          <span>No click or cursor data recorded yet for this page.</span>
        </div>
      )}

      {/* Canvas (always rendered so ref is available; hidden while loading) */}
      <div
        ref={containerRef}
        style={{ marginTop:12, width:'100%', display: (loadingSites || loading) ? 'none' : 'block' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display:'block', width:'100%', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc' }}
        />
      </div>
    </div>
  );
}