import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PAGES = ['/product', '/cart', '/checkout', '/payment'];
const VIEWPORT_W = 1280;
const VIEWPORT_H = 800;

function RageClicks() {
    const { token } = useAuth();
    const [selectedPage, setSelectedPage] = useState('/product');
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tooltip, setTooltip] = useState(null); // { x, y, zone }

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const fetchRageClicks = useCallback((page) => {
        if (!token) return;
        setLoading(true);
        setError('');
        setZones([]);

        fetch(`http://localhost:5000/api/analytics/rage-clicks?page=${encodeURIComponent(page)}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => setZones(data))
            .catch(err => setError(err.message || 'Failed to fetch rage click data'))
            .finally(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        fetchRageClicks(selectedPage);
    }, [selectedPage, fetchRageClicks]);

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;
        const scaleX = cw / VIEWPORT_W;
        const scaleY = ch / VIEWPORT_H;

        ctx.clearRect(0, 0, cw, ch);

        for (const zone of zones) {
            const cx = zone.x * scaleX;
            const cy = zone.y * scaleY;
            const radius = Math.max(8, Math.min(zone.click_count * 5, 40));

            // Glow
            const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
            gradient.addColorStop(0, 'rgba(220, 38, 38, 0.85)');
            gradient.addColorStop(1, 'rgba(220, 38, 38, 0.08)');
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Border
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(185, 28, 28, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Count label
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(10, radius * 0.6)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(zone.click_count, cx, cy);
        }
    }, [zones]);

    // Hit-test on hover
    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const scaleX = canvas.width / VIEWPORT_W;
        const scaleY = canvas.height / VIEWPORT_H;

        for (const zone of zones) {
            const cx = zone.x * scaleX;
            const cy = zone.y * scaleY;
            const radius = Math.max(8, Math.min(zone.click_count * 5, 40));
            const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
            if (dist <= radius) {
                setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, zone });
                return;
            }
        }
        setTooltip(null);
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Rage Clicks</h1>
                    <p style={styles.subtitle}>Zones where users clicked 3+ times rapidly — signals frustration.</p>
                </div>
                <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
            </div>

            {/* Controls Row */}
            <div style={styles.controlsRow}>
                <div style={styles.selectWrapper}>
                    <label style={styles.label}>Page:</label>
                    <div style={styles.customSelectWrapper}>
                        <select
                            value={selectedPage}
                            onChange={e => setSelectedPage(e.target.value)}
                            style={styles.select}
                            onMouseOver={(e) => e.target.style.borderColor = '#cbd5e1'}
                            onMouseOut={(e) => e.target.style.borderColor = '#e2e8f0'}
                            onFocus={(e) => { e.target.style.borderColor = '#667eea'; e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'; }}
                        >
                            {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <div style={styles.selectIcon}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                </div>
                <div style={styles.badge}>
                    {loading ? '…' : zones.length} zone{zones.length !== 1 ? 's' : ''} detected
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {/* Canvas Overlay */}
            <div style={styles.canvasCard}>
                <p style={styles.canvasLabel}>Viewport Overlay — {selectedPage}</p>
                <div ref={containerRef} style={styles.canvasWrapper}>
                    {/* Grey placeholder */}
                    <div style={styles.placeholder}>
                        <span style={styles.placeholderText}>Page Viewport (1280 × 800)</span>
                    </div>
                    <canvas
                        ref={canvasRef}
                        width={1280}
                        height={800}
                        style={styles.canvas}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setTooltip(null)}
                    />
                    {tooltip && (
                        <div style={{ ...styles.tooltip, left: tooltip.x + 12, top: tooltip.y + 12 }}>
                            <strong>Clicks in cluster:</strong> {tooltip.zone.click_count}<br />
                            <strong>Sessions affected:</strong> {tooltip.zone.session_count}<br />
                            <strong>Location:</strong> ({Math.round(tooltip.zone.x)}, {Math.round(tooltip.zone.y)})
                        </div>
                    )}
                    {loading && (
                        <div style={styles.canvasOverlay}>
                            <div style={styles.spinner} />
                        </div>
                    )}
                    {!loading && zones.length === 0 && !error && (
                        <div style={styles.canvasOverlay}>
                            <p style={{ color: '#999' }}>No rage clicks detected on {selectedPage}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            {zones.length > 0 && (
                <div style={styles.tableCard}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeaderRow}>
                                <th style={styles.th}>Page</th>
                                <th style={styles.th}>X</th>
                                <th style={styles.th}>Y</th>
                                <th style={styles.th}>Cluster Size</th>
                                <th style={styles.th}>Affected Sessions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zones.map((zone, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                                    <td style={styles.td}>{zone.page}</td>
                                    <td style={styles.td}>{zone.x}</td>
                                    <td style={styles.td}>{zone.y}</td>
                                    <td style={styles.td}>
                                        <span style={styles.clusterBadge}>{zone.click_count} clicks</span>
                                    </td>
                                    <td style={{ ...styles.td, fontWeight: 700, color: '#dc2626' }}>
                                        {zone.session_count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { padding: 40, maxWidth: 1200, margin: '0 auto' },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 16,
    },
    title: { margin: 0, fontSize: 28 },
    subtitle: { margin: '6px 0 0', color: '#666', fontSize: 15 },
    backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600 },
    controlsRow: {
        display: 'flex', alignItems: 'center', gap: 16,
        flexWrap: 'wrap', marginBottom: 20,
    },
    selectWrapper: { display: 'flex', alignItems: 'center', gap: 12 },
    label: { fontWeight: 600, fontSize: 14, color: '#444' },
    customSelectWrapper: { position: 'relative', display: 'inline-block', minWidth: '180px' },
    select: {
        width: '100%',
        padding: '10px 36px 10px 14px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1e293b',
        backgroundColor: '#ffffff',
        border: '2px solid #e2e8f0',
        borderRadius: '8px',
        appearance: 'none',
        outline: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.3s ease',
        fontFamily: 'inherit'
    },
    selectIcon: {
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: '#64748b', display: 'flex', alignItems: 'center'
    },
    badge: {
        padding: '6px 14px', borderRadius: 20,
        background: '#fee2e2', color: '#b91c1c',
        fontWeight: 700, fontSize: 13,
    },
    error: {
        background: '#ffe6e6', color: '#d63031', padding: 12,
        borderRadius: 8, marginBottom: 20,
    },
    canvasCard: {
        background: '#fff', borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        padding: '20px 20px 16px', marginBottom: 24,
    },
    canvasLabel: { margin: '0 0 12px', fontWeight: 600, fontSize: 14, color: '#555' },
    canvasWrapper: {
        position: 'relative', width: '100%', aspectRatio: '1280/800',
        borderRadius: 8, overflow: 'hidden',
    },
    placeholder: {
        position: 'absolute', inset: 0,
        background: 'linear-gradient(145deg, #f1f5f9 0%, #e2e8f0 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    placeholderText: { fontSize: 14, color: '#94a3b8' },
    canvas: {
        position: 'absolute', inset: 0,
        width: '100%', height: '100%', cursor: 'crosshair',
    },
    tooltip: {
        position: 'absolute', zIndex: 10,
        background: 'rgba(15,23,42,0.92)', color: '#fff',
        padding: '10px 14px', borderRadius: 8, fontSize: 13,
        lineHeight: 1.7, pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
    },
    canvasOverlay: {
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.6)',
    },
    spinner: {
        width: 36, height: 36,
        border: '4px solid #e2e8f0', borderTop: '4px solid #dc2626',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    tableCard: {
        background: '#fff', borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflowX: 'auto',
    },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: 540 },
    tableHeaderRow: { background: '#f8f9fc' },
    th: { textAlign: 'left', padding: '14px 16px', fontSize: 13, color: '#555', fontWeight: 600 },
    td: { padding: '14px 16px', fontSize: 14, color: '#222' },
    clusterBadge: {
        display: 'inline-block', padding: '3px 10px', borderRadius: 12,
        background: '#fee2e2', color: '#b91c1c', fontWeight: 600, fontSize: 12,
    },
};

if (typeof document !== 'undefined' && !document.getElementById('rc-spinner-style')) {
    const s = document.createElement('style');
    s.id = 'rc-spinner-style';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
}

export default RageClicks;
