import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";

// Reference viewport dimensions used during data capture (matches seed.js clamp values)
const REF_W = 1280;
const REF_H = 800;

// Admin/app routes that should never appear in the website-page selector
const EXCLUDED_ADMIN_ROUTES = new Set([
  "/dashboard",
  "/session-analytics",
  "/risk-prediction",
  "/sentiment-insights",
  "/heatmap",
  "/scroll-heatmap",
  "/time-on-page",
  "/entry-exit",
  "/rage-clicks",
  "/nav-paths",
  "/conversion-influence",
  "/engagement-scores",
  "/users",
  "/login",
  "/register",
]);

function normaliseRoute(route) {
  if (!route || typeof route !== "string") return "";
  const trimmed = route.trim();
  if (!trimmed) return "";
  if (trimmed === "/") return "/";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function isClientWebsiteRoute(route) {
  const normalised = normaliseRoute(route);
  if (!normalised) return false;
  return !EXCLUDED_ADMIN_ROUTES.has(normalised);
}

// Rounded-rectangle path helper for the reference wireframe.
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Draws a generic page-layout wireframe (header, hero, cards, footer) onto an
// underlay canvas so heat points have visual context during presentations.
// All coordinates are expressed in the 1280x800 reference space and scaled.
function drawReferenceWireframe(canvas, w, h) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const sx = w / REF_W;
  const sy = h / REF_H;
  const s = Math.min(sx, sy);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const block = (x, y, bw, bh, fill, stroke, r = 6) => {
    roundRect(ctx, x * sx, y * sy, bw * sx, bh * sy, r * s);
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = Math.max(1, s); ctx.strokeStyle = stroke; ctx.stroke(); }
  };

  // Header bar + logo + nav links
  block(0, 0, REF_W, 64, "#f8fafc", "#e2e8f0", 0);
  block(40, 20, 120, 24, "#cbd5e1", null, 6);
  for (let i = 0; i < 4; i++) block(REF_W - 360 + i * 90, 24, 64, 16, "#e2e8f0", null, 4);

  // Hero band with heading, subtext and a call-to-action button
  block(40, 96, REF_W - 80, 180, "#f1f5f9", "#e2e8f0", 10);
  block(80, 140, 360, 28, "#cbd5e1", null, 6);
  block(80, 184, 260, 18, "#dbe2ea", null, 4);
  block(80, 214, 160, 36, "#c7d2fe", null, 8);

  // Three content cards
  const cardY = 312;
  const cardW = (REF_W - 80 - 2 * 24) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = 40 + i * (cardW + 24);
    block(cx, cardY, cardW, 220, "#f8fafc", "#e2e8f0", 10);
    block(cx + 16, cardY + 16, cardW - 32, 110, "#eef2f7", null, 6);
    block(cx + 16, cardY + 140, cardW - 80, 18, "#cbd5e1", null, 4);
    block(cx + 16, cardY + 168, cardW - 40, 14, "#dbe2ea", null, 4);
  }

  // Footer bar
  block(0, REF_H - 56, REF_W, 56, "#f1f5f9", "#e2e8f0", 0);
}

export default function Heatmap() {

  const canvasRef   = useRef(null);
  const bgCanvasRef = useRef(null);
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
        const arr = (Array.isArray(list) ? list : []).filter(isClientWebsiteRoute);
        setPages(arr);
        // Reset to first page of the NEW site
        setPage(arr.length > 0 ? arr[0] : '');
      })
      .catch(() => { setPages([]); setPage(''); });
  }, [token, currentSiteId]);

  useEffect(() => {
    if (!token || !currentSiteId || !page) {
      setHasData(false);
      setError('');
      setLoading(Boolean(token && currentSiteId && !page) ? false : true);
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

        // Draw the reference page wireframe on the underlay canvas so heat
        // points are shown in the context of a typical page layout.
        const bgCanvas = bgCanvasRef.current;
        if (bgCanvas) {
          bgCanvas.width  = canvasW;
          bgCanvas.height = canvasH;
          drawReferenceWireframe(bgCanvas, canvasW, canvasH);
        }

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
          {pages.length === 0 && <option value="">No website routes for selected site</option>}
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
        style={{ marginTop:12, width:'100%', position:'relative', display: (loadingSites || loading) ? 'none' : 'block' }}
      >
        {/* Underlay: reference page wireframe for visual context */}
        <canvas
          ref={bgCanvasRef}
          style={{ display:'block', width:'100%', border:'1px solid #e2e8f0', borderRadius:8, background:'#ffffff' }}
        />
        {/* Overlay: transparent heat layer aligned to the wireframe */}
        <canvas
          ref={canvasRef}
          style={{ position:'absolute', top:0, left:0, display:'block', width:'100%', background:'transparent', pointerEvents:'none' }}
        />
      </div>

      {/* Legend */}
      {!loadingSites && !loading && !error && hasData && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, fontSize:13, color:'#64748b' }}>
          <span style={{ fontWeight:600 }}>Density</span>
          <span>Low</span>
          <div style={{
            width:160, height:12, borderRadius:6, border:'1px solid #e2e8f0',
            background:'linear-gradient(to right, rgba(0,0,255,0.5), #00ffff, #00ff00, #ffff00, #ff0000)',
          }} />
          <span>High</span>
          <span style={{ marginLeft:'auto', fontSize:12, color:'#94a3b8' }}>Background is a reference page layout, not the live page.</span>
        </div>
      )}
    </div>
  );
}