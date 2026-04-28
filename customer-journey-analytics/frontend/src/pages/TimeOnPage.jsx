import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';

function TimeOnPage() {
    const { token } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        fetch('http://localhost:5000/api/analytics/time-on-page', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(result => {
                setData(result);
                setError('');
            })
            .catch(err => setError(err.message || 'Failed to fetch time-on-page data'))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div style={styles.center}>
                <div style={styles.spinner} />
                <p style={{ color: '#666', marginTop: 16 }}>Loading time-on-page analytics...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Time on Page</h1>
                    <p style={styles.subtitle}>Average, median, and 90th-percentile dwell times per page.</p>
                </div>
                <Link to="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {data.length === 0 && !error ? (
                <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>No page view data available yet.</p>
            ) : (
                <>
                    {/* Chart */}
                    <div style={styles.chartCard}>
                        <ResponsiveContainer width="100%" height={380}>
                            <BarChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <XAxis dataKey="page" tick={{ fill: '#666', fontSize: 13 }} />
                                <YAxis
                                    tick={{ fill: '#666', fontSize: 12 }}
                                    label={{ value: 'Seconds', angle: -90, position: 'insideLeft', fill: '#999', fontSize: 13 }}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                                    formatter={(value) => [`${value}s`]}
                                />
                                <Legend wrapperStyle={{ fontSize: 13 }} />
                                <Bar dataKey="avg_dwell_seconds" name="Avg" fill="#667eea" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="median_dwell_seconds" name="Median" fill="#34d399" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="p90_dwell_seconds" name="P90" fill="#fb923c" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div style={styles.tableCard}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeaderRow}>
                                    <th style={styles.th}>Page</th>
                                    <th style={styles.th}>Avg Time</th>
                                    <th style={styles.th}>Median Time</th>
                                    <th style={styles.th}>P90 Time</th>
                                    <th style={styles.th}>Total Sessions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row) => {
                                    const isLow = row.avg_dwell_seconds < 30;
                                    return (
                                        <tr key={row.page} style={{ borderTop: '1px solid #eee', background: isLow ? '#fff5f5' : 'transparent' }}>
                                            <td style={{ ...styles.td, fontWeight: 600, color: isLow ? '#d63031' : '#222' }}>
                                                {row.page}
                                                {isLow && <span style={styles.badge}>Low engagement</span>}
                                            </td>
                                            <td style={{ ...styles.td, color: isLow ? '#d63031' : '#222' }}>{row.avg_dwell_seconds}s</td>
                                            <td style={styles.td}>{row.median_dwell_seconds}s</td>
                                            <td style={styles.td}>{row.p90_dwell_seconds}s</td>
                                            <td style={styles.td}>{row.total_sessions}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

const styles = {
    container: {
        padding: '40px',
        maxWidth: '1100px',
        margin: '0 auto',
    },
    center: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '80vh',
    },
    spinner: {
        width: 40,
        height: 40,
        border: '4px solid #e2e8f0',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 28,
        flexWrap: 'wrap',
        gap: 16,
    },
    title: { margin: 0, fontSize: 28 },
    subtitle: { margin: '6px 0 0', color: '#666', fontSize: 15 },
    backLink: { color: '#667eea', textDecoration: 'none', fontWeight: 600 },
    error: {
        background: '#ffe6e6',
        color: '#d63031',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    chartCard: {
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        padding: '24px 16px',
        marginBottom: 24,
    },
    tableCard: {
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        overflowX: 'auto',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: 600,
    },
    tableHeaderRow: {
        background: '#f8f9fc',
    },
    th: {
        textAlign: 'left',
        padding: '14px 16px',
        fontSize: 13,
        color: '#555',
        fontWeight: 600,
    },
    td: {
        padding: '14px 16px',
        fontSize: 14,
        color: '#222',
    },
    badge: {
        display: 'inline-block',
        marginLeft: 8,
        padding: '2px 8px',
        borderRadius: 12,
        background: '#d63031',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
    },
};

// Inject spinner keyframe
if (typeof document !== 'undefined' && !document.getElementById('top-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'top-spinner-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
}

export default TimeOnPage;
