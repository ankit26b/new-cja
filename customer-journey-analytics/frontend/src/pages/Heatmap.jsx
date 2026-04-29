import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";

export default function Heatmap() {

  const canvasRef = useRef(null);
  const [page, setPage] = useState("/product");
  const { token } = useAuth();

  useEffect(() => {

    fetch(`http://localhost:5000/api/heatmap?page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {

        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const heat = simpleheat(canvas);

        const points = Array.isArray(data) ? data.map(point => [
          point.x,
          point.y,
          3
        ]) : [];

        heat.data(points);
        heat.max(5);
        heat.draw();

      });

  }, [page, token]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Heatmap Viewer</h1>
        <Link to="/dashboard" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>← Back to Dashboard</Link>
      </div>

      <div style={{ position: 'relative', display: 'inline-block', minWidth: '200px' }}>
        <select 
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
          <option value="/product">Product</option>
          <option value="/cart">Cart</option>
          <option value="/checkout">Checkout</option>
          <option value="/payment">Payment</option>
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

      <canvas
        ref={canvasRef}
        style={{
          marginTop: 20,
          border: "1px solid #ccc"
        }}
      />
    </div>
  );
}