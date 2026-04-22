import { useEffect, useRef, useState } from "react";
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
      <h1>Heatmap Viewer</h1>

      <select onChange={(e) => setPage(e.target.value)}>
        <option value="/product">Product</option>
        <option value="/cart">Cart</option>
        <option value="/checkout">Checkout</option>
        <option value="/payment">Payment</option>
      </select>

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