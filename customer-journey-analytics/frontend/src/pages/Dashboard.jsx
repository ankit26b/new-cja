import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";



export default function Dashboard() {

  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/funnel")
      .then(res => res.json())
      .then(data => setData(data));
  }, []);

  const [risk, setRisk] = useState(null);

  function checkRisk() {
    const sessionId = sessionStorage.getItem("cja_session_id");

    fetch(`http://localhost:5000/api/predict/${sessionId}`)
      .then(res => res.json())
      .then(data => setRisk(data));
  }

  return (
    <>
      <div style={{ padding: 40 }}>
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