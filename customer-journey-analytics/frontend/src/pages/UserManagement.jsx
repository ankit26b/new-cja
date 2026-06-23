import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserManagement() {
    const { token, user } = useAuth();
    const [users, setUsers] = useState([]);
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [savingSitesUserId, setSavingSitesUserId] = useState(null);
    const [siteSelections, setSiteSelections] = useState({});

    const fetchUsers = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            setError('');
            const res = await fetch('http://localhost:5000/api/auth/users-with-sites', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch users');
            }

            const listedUsers = data.users || [];
            setUsers(listedUsers);
            const initialSelections = {};
            listedUsers.forEach((listedUser) => {
                initialSelections[listedUser.id] = listedUser.site_ids || [];
            });
            setSiteSelections(initialSelections);
        } catch (err) {
            setError(err.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchSites = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('http://localhost:5000/api/sites', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch sites');
            }
            setSites(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Failed to fetch sites');
        }
    }, [token]);

    useEffect(() => {
        fetchUsers();
        fetchSites();
    }, [fetchUsers, fetchSites]);

    const handleRoleToggle = async (targetUser) => {
        const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
        setUpdatingUserId(targetUser.id);
        setError('');

        try {
            const res = await fetch(`http://localhost:5000/api/auth/users/${targetUser.id}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role: nextRole }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update role');
            }

            await fetchUsers();
        } catch (err) {
            setError(err.message || 'Failed to update role');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const toggleSiteSelection = (userId, siteId) => {
        setSiteSelections((prev) => {
            const selected = prev[userId] || [];
            const next = selected.includes(siteId)
                ? selected.filter((id) => id !== siteId)
                : [...selected, siteId];
            return { ...prev, [userId]: next };
        });
    };

    const saveSiteAssignments = async (targetUser) => {
        setSavingSitesUserId(targetUser.id);
        setError('');
        try {
            const selectedSiteIds = siteSelections[targetUser.id] || [];
            const res = await fetch(`http://localhost:5000/api/auth/users/${targetUser.id}/sites`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ site_ids: selectedSiteIds }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update site assignments');
            }

            await fetchUsers();
        } catch (err) {
            setError(err.message || 'Failed to update site assignments');
        } finally {
            setSavingSitesUserId(null);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ marginBottom: '8px' }}>User Management</h1>
                    <p style={{ margin: 0, color: '#666' }}>View users and manage admin access.</p>
                </div>
                <Link to="/dashboard" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>
                    ← Back to Dashboard
                </Link>
            </div>

            {error && (
                <div style={{ background: '#ffe6e6', color: '#d63031', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <p>Loading users...</p>
            ) : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fc' }}>
                                <th style={tableHeaderStyle}>ID</th>
                                <th style={tableHeaderStyle}>Username</th>
                                <th style={tableHeaderStyle}>Email</th>
                                <th style={tableHeaderStyle}>Role</th>
                                <th style={tableHeaderStyle}>Site Access</th>
                                <th style={tableHeaderStyle}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((listedUser) => {
                                const isCurrentUser = listedUser.id === user?.id;
                                const username = listedUser.username || listedUser.email?.split('@')[0] || '—';
                                const nextActionLabel = listedUser.role === 'admin' ? 'Demote to User' : 'Make Admin';
                                const isUpdating = updatingUserId === listedUser.id;
                                const siteAccess = siteSelections[listedUser.id] || [];
                                const isSavingSites = savingSitesUserId === listedUser.id;

                                return (
                                    <tr key={listedUser.id} style={{ borderTop: '1px solid #eee' }}>
                                        <td style={tableCellStyle}>{listedUser.id}</td>
                                        <td style={tableCellStyle}>{username}</td>
                                        <td style={tableCellStyle}>{listedUser.email}</td>
                                        <td style={tableCellStyle}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '6px 10px',
                                                borderRadius: '999px',
                                                background: listedUser.role === 'admin' ? '#ede9fe' : '#eef2ff',
                                                color: listedUser.role === 'admin' ? '#6d28d9' : '#4338ca',
                                                fontWeight: 600,
                                                textTransform: 'capitalize'
                                            }}>
                                                {listedUser.role}
                                            </span>
                                        </td>
                                        <td style={tableCellStyle}>
                                            {listedUser.role === 'admin' ? (
                                                <span style={{ color: '#64748b', fontSize: 13 }}>All sites (master admin)</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {sites.map((site) => (
                                                            <label key={`${listedUser.id}-${site.site_id}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={siteAccess.includes(site.site_id)}
                                                                    onChange={() => toggleSiteSelection(listedUser.id, site.site_id)}
                                                                    disabled={isSavingSites}
                                                                />
                                                                {site.display_name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => saveSiteAssignments(listedUser)}
                                                        disabled={isSavingSites}
                                                        style={{ ...actionButtonStyle, width: 150, opacity: isSavingSites ? 0.7 : 1 }}
                                                    >
                                                        {isSavingSites ? 'Saving...' : 'Save Sites'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={tableCellStyle}>
                                            {isCurrentUser ? (
                                                <button disabled style={{ ...actionButtonStyle, opacity: 0.5, cursor: 'not-allowed' }}>
                                                    Current User
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRoleToggle(listedUser)}
                                                    disabled={isUpdating}
                                                    style={{ ...actionButtonStyle, opacity: isUpdating ? 0.7 : 1 }}
                                                >
                                                    {isUpdating ? 'Updating...' : nextActionLabel}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const tableHeaderStyle = {
    textAlign: 'left',
    padding: '16px',
    fontSize: '14px',
    color: '#444',
};

const tableCellStyle = {
    padding: '16px',
    fontSize: '15px',
    color: '#222',
};

const actionButtonStyle = {
    padding: '10px 14px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
};

export default UserManagement;
