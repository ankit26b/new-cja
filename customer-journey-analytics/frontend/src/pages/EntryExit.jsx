import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { useAuth } from '../context/AuthContext';

function EntryExit() {
    const { token } = useAuth();
    const [entryPages, setEntryPages] = useState([]);
    const [exitPages, setExitPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        fetch('http://localhost:5000/api/analytics/entry-exit', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                setEntryPages(data.entryPages || []);
                setExitPages(data.exitPages || []);
                setError('');
            })
            .catch(err => setError(err.message || 'Failed to fetch entry/exit data'))
            .finally(() => setLoading(false));
    }, [token]);

    const highestExitRate = exitPages.length > 0
        ? exitPages.reduce((max, p) => p.exit_rate > max.exit_rate ? p : max, exitPages[0])
        : null;

    if (loading) {
        return (
            <div style={styles.center}>
                <div style={styles.spinner} />
                <p style={{ color: '#666', marginTop: 16 }}>Loading entry &amp; exit analytics...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Entry &amp; Exit Pages</h1>
                    <p style={styles.subtitle}>Where users start and where they leave.</p>
                </div>
                <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {entryPages.length === 0 && exitPages.length === 0 && !error ? (
                <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No page view data available yet.</p>
            ) : (
                <>
                    <div style={styles.chartsRow}>
                        {/* Entry Pages */}
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>
                                <span style={{ ...styles.dot, background: '#34d399' }} />
                                Entry Pages
                            </h3>
                            <p style={styles.chartSubtitle}>Sessions that started on each page</p>
                            <ResponsiveContainer width="100%" height={Math.max(200, entryPages.length * 50)}>
                                <BarChart data={entryPages} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                                    <XAxis type="number" tick={{ fill: '#666', fontSize: 12 }} />
                                    <YAxis dataKey="page" type="category" width={100} tick={{ fill: '#333', fontSize: 13 }} />
                                    <Tooltip
                                        contentStyle={styles.tooltip}
                                        formatter={(value) => [`${value} sessions`]}
                                    />
                                    <Bar dataKey="session_count" name="Sessions" radius={[0, 6, 6, 0]} barSize={28}>
                                        {entryPages.map((_, i) => (
                                            <Cell key={i} fill="#34d399" />
                                        ))}
                                        <LabelList dataKey="session_count" position="right" fill="#333" fontSize={13} fontWeight={600} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Exit Pages */}
                        <div style={styles.chartCard}>
                            <h3 style={styles.chartTitle}>
                                <span style={{ ...styles.dot, background: '#ef4444' }} />
                                Exit Pages
                            </h3>
                            <p style={styles.chartSubtitle}>Sessions that ended on each page (with exit rate)</p>
                            <ResponsiveContainer width="100%" height={Math.max(200, exitPages.length * 50)}>
                                <BarChart data={exitPages} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                                    <XAxis type="number" tick={{ fill: '#666', fontSize: 12 }} />
                                    <YAxis dataKey="page" type="category" width={100} tick={{ fill: '#333', fontSize: 13 }} />
                                    <Tooltip
                                        contentStyle={styles.tooltip}
                                        formatter={(value, name) => {
                                            if (name === 'Sessions') return [`${value} sessions`];
                                            return [value];
                                        }}
                                    />
                                    <Bar dataKey="session_count" name="Sessions" radius={[0, 6, 6, 0]} barSize={28}>
                                        {exitPages.map((_, i) => (
                                            <Cell key={i} fill="#ef4444" />
                                        ))}
                                        <LabelList
                                            dataKey="exit_rate"
                                            position="right"
                                            fill="#b91c1c"
                                            fontSize={12}
                                            fontWeight={600}
                                            formatter={(val) => `${val}%`}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Callout */}
                    {highestExitRate && (
                        <div style={styles.callout}>
                            <div style={styles.calloutIcon}>⚠️</div>
                            <div>
                                <h4 style={styles.calloutTitle}>Biggest Drop-off Point</h4>
                                <p style={styles.calloutText}>
                                    <strong style={{ color: '#dc2626' }}>{highestExitRate.page}</strong> has the highest exit rate at{' '}
                                    <strong style={{ color: '#dc2626' }}>{highestExitRate.exit_rate}%</strong>{' '}
                                    ({highestExitRate.session_count} sessions exited here).
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const styles = {
    container: { padding: 40, maxWidth: 1200, margin: '0 auto' },
    center: {
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '80vh',
    },
    spinner: {
        width: 40, height: 40,
        border: '4px solid #e2e8f0', borderTop: '4px solid #667eea',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 28, flexWrap: 'wrap', gap: 16,
    },
    title: { margin: 0, fontSize: 28 },
    subtitle: { margin: '6px 0 0', color: '#666', fontSize: 15 },
    backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600 },
    error: {
        background: '#ffe6e6', color: '#d63031', padding: 12,
        borderRadius: 8, marginBottom: 20,
    },
    chartsRow: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
    },
    chartCard: {
        background: '#fff', borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '24px 16px',
    },
    chartTitle: {
        margin: 0, fontSize: 16, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 8,
    },
    chartSubtitle: { margin: '4px 0 16px', color: '#888', fontSize: 13 },
    dot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
    tooltip: {
        background: '#fff', border: '1px solid #e2e8f0',
        borderRadius: 8, fontSize: 13,
    },
    callout: {
        marginTop: 24, display: 'flex', gap: 16, alignItems: 'flex-start',
        padding: '20px 24px', borderRadius: 12,
        background: '#fff5f5', border: '1px solid #fecaca',
    },
    calloutIcon: { fontSize: 28, flexShrink: 0 },
    calloutTitle: {
        margin: 0, fontSize: 16, fontWeight: 700, color: '#dc2626',
    },
    calloutText: { margin: '6px 0 0', fontSize: 14, color: '#444', lineHeight: 1.6 },
};

if (typeof document !== 'undefined' && !document.getElementById('ee-spinner-style')) {
    const s = document.createElement('style');
    s.id = 'ee-spinner-style';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:768px){.ee-grid{grid-template-columns:1fr!important}}';
    document.head.appendChild(s);
}

export default EntryExit;
