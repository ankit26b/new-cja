import { Link } from "react-router-dom";
import { useEffect } from "react";
import simpleheat from "simpleheat";

export default function Product() {

  useEffect(() => {

    const canvas = document.getElementById("heatmapCanvas");

    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const heat = simpleheat(canvas);

    fetch("http://localhost:5000/api/heatmap?page=/product")
      .then(res => res.json())
      .then(data => {

        const points = data.map(point => [
          point.x,
          point.y,
          1
        ]);

        heat.data(points);
        heat.max(5);
        heat.draw();

      });

  }, []);

  return (
    <div id="productContainer" style={{ position: "relative" }}>

      <div style={{ padding: "40px" }}>
        <h1>Product Page</h1>
        <button>Add to Cart</button>
        <br /><br />
        <Link to="/cart">Go to Cart</Link>

        <div style={{ height: "1500px" }}>
          <p>Scroll for product details...</p>
        </div>
      </div>

      {/* Heatmap Canvas Overlay */}
      <canvas
        id="heatmapCanvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}