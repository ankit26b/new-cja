import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "../context/AuthContext";



export default function Dashboard() {

  const { token, user, logout } = useAuth();

  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/funnel", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => setData(data));
  }, [token]);

  const [risk, setRisk] = useState(null);
  const [riskError, setRiskError] = useState('');

  function checkRisk() {
    const sessionId = sessionStorage.getItem("cja_session_id");
    setRiskError('');

    fetch(`http://localhost:5000/api/predict/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }
        return res.json();
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
          <button onClick={logout}>Logout</button>
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

        <BarChart width={600} height={300} data={data}>
          <XAxis dataKey="stage" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="users" fill="#8884d8" />
        </BarChart>
      </div>

      <button onClick={checkRisk} style={{ marginTop: 20 }}>
        Check My Drop-Off Risk
      </button>

      {riskError && (
        <div style={{ marginTop: 20, padding: 20, background: '#ffe6e6', borderRadius: '8px', color: '#d63031' }}>
          <h3>Error</h3>
          <p>{riskError}</p>
          <p style={{ fontSize: '14px', color: '#999' }}>Make sure the ML server is running at http://localhost:8000</p>
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