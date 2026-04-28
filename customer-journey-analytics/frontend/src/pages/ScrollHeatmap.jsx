import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import simpleheat from "simpleheat";
import { useAuth } from "../context/AuthContext";

export default function ScrollHeatmap() {

    const canvasRef = useRef(null);
    const [page, setPage] = useState("/product");
    const { token } = useAuth();

    useEffect(() => {

        fetch(`http://localhost:5000/api/scrollmap?page=${page}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(res => res.json())
            .then(data => {

                const canvas = canvasRef.current;
                canvas.width = 400;          // narrower canvas for vertical heat
                canvas.height = 1500;        // match scrollable height

                const heat = simpleheat(canvas);

                // 🔥 THIS IS WHERE YOU ADD IT
                const points = Array.isArray(data) ? data.map(item => [
                    200,                // fixed horizontal center
                    item.scroll_depth,  // vertical scroll position
                    1                   // intensity
                ]) : [];

                heat.data(points);
                heat.max(10);
                heat.draw();

            });

    }, [page, token]);

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ margin: 0 }}>Scroll Heatmap</h1>
                <Link to="/dashboard" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>← Back to Dashboard</Link>
            </div>

            <select onChange={(e) => setPage(e.target.value)}>
                <option value="/product">Product</option>
                <option value="/cart">Cart</option>
                <option value="/checkout">Checkout</option>
                <option value="/payment">Payment</option>
            </select>

            <div style={{ marginTop: 20 }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        border: "1px solid #ccc",
                        background: "#f5f5f5"
                    }}
                />
            </div>
        </div>
    );
}