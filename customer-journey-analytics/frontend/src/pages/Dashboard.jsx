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

  function checkRisk() {
    const sessionId = sessionStorage.getItem("cja_session_id");

    fetch(`http://localhost:5000/api/predict/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => setRisk(data));
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