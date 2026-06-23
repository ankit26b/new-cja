import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import SiteSelector from "../components/SiteSelector";



export default function Dashboard() {

  const { token, user, logout } = useAuth();
  const { currentSiteId, loadingSites, availableSites } = useSite();

  const [data, setData] = useState([]);
  const [funnelLoading, setFunnelLoading] = useState(true);
  const [funnelError, setFunnelError] = useState('');

  useEffect(() => {
    if (!token || !currentSiteId) {
      setData([]);
      setFunnelLoading(true);
      setFunnelError('');
      return;
    }

    const controller = new AbortController();
    setFunnelLoading(true);
    setFunnelError('');
    setData([]);

    fetch(`http://localhost:5000/api/funnel?site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setData(data);
        } else {
          setFunnelError('Invalid funnel response');
          setData([]);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setFunnelError(err.message || 'Failed to load funnel data');
        setData([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFunnelLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, currentSiteId]);

  const [risk, setRisk] = useState(null);
  const [riskError, setRiskError] = useState('');

  function checkRisk() {
    setRiskError('');

    if (!currentSiteId) {
      setRiskError('Select a site first');
      setRisk(null);
      return;
    }

    const siteSessionKey = `cja_session_id_${currentSiteId}`;
    const sessionId = sessionStorage.getItem(siteSessionKey) || sessionStorage.getItem("cja_session_id");
    if (!sessionId) {
      setRiskError('No tracked session found for this site yet. Navigate a page in this site, then retry.');
      setRisk(null);
      return;
    }

    fetch(`http://localhost:5000/api/predict/${sessionId}?site_id=${encodeURIComponent(currentSiteId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async res => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(payload?.error || 'No tracked session found for this site yet. Navigate a page in this site, then retry.');
          }
          if (payload?.error) {
            throw new Error(payload.error);
          }
          throw new Error(`Server error: ${res.status}`);
        }
        return payload;
      })
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.drop_off_probability === undefined) {
          throw new Error('Invalid response format');
        }
        setRisk(data);
        setRiskError('');
      })
      .catch(err => {
        setRiskError(err.message || 'Failed to check risk');
        setRisk(null);
      });
  }

  return (
    <>
      <div style={{ padding: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2>Welcome, {user?.email} ({user?.role})</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <SiteSelector />
            <button onClick={logout}>Logout</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <Link to="/heatmap" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            View Heatmap
          </Link>
          <Link to="/scroll-heatmap" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            View Scroll Heatmap
          </Link>
          <Link to="/users" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Manage Users
          </Link>
          <Link to="/time-on-page" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Time on Page
          </Link>
          <Link to="/entry-exit" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Entry & Exit Pages
          </Link>
          <Link to="/rage-clicks" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Rage Clicks
          </Link>
          <Link to="/nav-paths" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Navigation Paths
          </Link>
          <Link to="/conversion-influence" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Conversion Influencer
          </Link>
          <Link to="/engagement-scores" style={{ color: "#667eea", textDecoration: "none", fontWeight: 600 }}>
            Engagement Scores
          </Link>
        </div>
        <h1>Funnel Analysis</h1>
        {currentSiteId && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Site: <span style={{ fontWeight: 600, color: '#64748b' }}>
              {availableSites.find(s => s.site_id === currentSiteId)?.display_name || currentSiteId}
            </span>
          </div>
        )}

        {loadingSites || funnelLoading ? (
          <p style={{ color: '#64748b' }}>Loading funnel data...</p>
        ) : funnelError ? (
          <p style={{ color: '#dc2626' }}>{funnelError}</p>
        ) : data.length === 0 ? (
          <p style={{ color: '#64748b' }}>No sessions recorded yet for this site.</p>
        ) : (
          <BarChart width={600} height={300} data={data}>
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="users" fill="#8884d8" />
          </BarChart>
        )}

      </div>

      <button onClick={checkRisk} style={{ marginTop: 20 }}>
        Check My Drop-Off Risk
      </button>

      {riskError && (
        <div style={{ marginTop: 20, padding: 20, background: '#ffe6e6', borderRadius: '8px', color: '#d63031' }}>
          <h3>Error</h3>
          <p>{riskError}</p>
          {riskError.toLowerCase().includes('prediction error') && (
            <p style={{ fontSize: '14px', color: '#999' }}>Make sure the ML server is running at http://localhost:8000</p>
          )}
        </div>
      )}

      {risk && (
        <div style={{ marginTop: 20, padding: 20, border: "1px solid #ccc" }}>
          <h3>Prediction Result</h3>
          <p>Probability: {risk.drop_off_probability.toFixed(2)}</p>

          {risk.drop_off_probability > 0.7 && <p style={{ color: "red" }}>HIGH RISK 🔴</p>}
          {risk.drop_off_probability <= 0.7 && risk.drop_off_probability > 0.4 && <p style={{ color: "orange" }}>MEDIUM RISK 🟡</p>}
          {risk.drop_off_probability <= 0.4 && <p style={{ color: "green" }}>LOW RISK 🟢</p>}
        </div>
      )}
    </>



  );
}