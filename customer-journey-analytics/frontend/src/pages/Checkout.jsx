import { Link } from "react-router-dom";
import { useState } from "react";

export default function Checkout() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const submitFeedback = () => {
    fetch("http://localhost:5000/api/sentiment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    })
      .then(res => res.json())
      .then(data => setResult(data));
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Checkout Page</h1>

      <textarea
        placeholder="Enter feedback..."
        onChange={(e) => setText(e.target.value)}
      />

      <br /><br />

      <button onClick={submitFeedback}>
        Analyze Sentiment
      </button>

      {result && (
        <div>
          <h3>{result.label}</h3>
          <p>Confidence: {result.score}</p>
        </div>
      )}
    </div>
  );
}