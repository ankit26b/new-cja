import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";

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

export default function ScrollHeatmap() {

    const canvasRef = useRef(null);
    const [page, setPage] = useState("");
    const [pages, setPages] = useState([]);
    const { token } = useAuth();
    const { currentSiteId, loadingSites, availableSites } = useSite();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasData, setHasData] = useState(false);

    // Fetch available pages dynamically
    useEffect(() => {
        if (!token || !currentSiteId) { setPages([]); return; }
        fetch(`http://localhost:5000/api/analytics/pages?site_id=${encodeURIComponent(currentSiteId)}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => res.ok ? res.json() : [])
            .then(list => {
                const filteredPages = (Array.isArray(list) ? list : []).filter(isClientWebsiteRoute);
                setPages(filteredPages);
                setPage((prev) => (filteredPages.includes(prev) ? prev : (filteredPages[0] || "")));
            })
            .catch(() => {
                setPages([]);
                setPage("");
            });
    }, [token, currentSiteId]);

    useEffect(() => {
        if (!token || !currentSiteId || !page) {
            setLoading(true);
            setError('');
            setHasData(false);
            if (!page) {
                setLoading(false);
            }
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError('');
        setHasData(false);

        fetch(`http://localhost:5000/api/scrollmap?page=${page}&site_id=${encodeURIComponent(currentSiteId)}`, {
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

                const CANVAS_W = 360;        // narrower so bands read as a tall page column
                const CANVAS_H = 2000;       // taller to stretch scroll depth vertically
                canvas.width = CANVAS_W;
                canvas.height = CANVAS_H;

                const rows = Array.isArray(data) ? data : [];
                setHasData(rows.length > 0);

                const heat = simpleheat(canvas);

                // --- Aggregate scroll depths into buckets ----------------------
                // Instead of stacking every reading onto one point (which clumps
                // into a thin vertical streak), bucket depths and spread each
                // bucket across the full width as a horizontal band. Intensity
                // scales with how many users reached that depth, so the result
                // "melts" into smooth, readable bands.
                const BUCKET = 24;                       // px per depth bucket
                const COLS = 8;                          // horizontal samples per band
                const counts = new Map();                // bucketedDepth -> count
                let maxCount = 0;

                rows.forEach(item => {
                    const depth = Number(item.scroll_depth) || 0;
                    const b = Math.round(depth / BUCKET) * BUCKET;
                    const next = (counts.get(b) || 0) + 1;
                    counts.set(b, next);
                    if (next > maxCount) maxCount = next;
                });

                const points = [];
                counts.forEach((count, depth) => {
                    for (let c = 0; c < COLS; c++) {
                        const x = ((c + 0.5) / COLS) * CANVAS_W;
                        points.push([x, depth, count]);
                    }
                });

                // Large radius + heavy blur melts adjacent samples into bands.
                heat.data(points);
                heat.radius(55, 45);
                heat.max(Math.max(1, maxCount));
                heat.draw(0.08);

            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setError(err.message || 'Failed to load scroll heatmap data');
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
                    <h1 style={{ margin: 0 }}>Scroll Heatmap</h1>
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
                    {pages.length === 0 && <option value="">No website routes for selected site</option>}
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

            <div style={{ marginTop: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        border: "1px solid #ccc",
                        background: "#f5f5f5",
                        borderRadius: 8,
                        maxWidth: '100%',
                        height: 'auto'
                    }}
                />
                {!loadingSites && !loading && !error && hasData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Reach</div>
                        <div style={{
                            width: 14, height: 220, borderRadius: 7, border: '1px solid #e2e8f0',
                            background: 'linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, rgba(0,0,255,0.5))'
                        }} />
                        <div style={{ fontSize: 12, color: '#64748b' }}>Most</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 'auto' }}>Few</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 90, marginTop: 8 }}>
                            Top = page top. Bands show how far visitors scroll.
                        </div>
                    </div>
                )}
            </div>

            {loadingSites || loading ? <p style={{ color: '#64748b', marginTop: 12 }}>Loading scroll heatmap...</p> : null}
            {!loadingSites && !loading && error ? <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p> : null}
            {!loadingSites && !loading && !error && !hasData ? (
                <p style={{ color: '#64748b', marginTop: 12 }}>No sessions recorded yet for this site.</p>
            ) : null}
        </div>
    );
}