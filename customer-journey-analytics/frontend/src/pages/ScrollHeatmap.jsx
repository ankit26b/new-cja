import { useEffect, useRef, useState } from "react";
import simpleheat from "simpleheat";

export default function ScrollHeatmap() {

    const canvasRef = useRef(null);
    const [page, setPage] = useState("/product");

    useEffect(() => {

        fetch(`http://localhost:5000/api/scrollmap?page=${page}`)
            .then(res => res.json())
            .then(data => {

                const canvas = canvasRef.current;
                canvas.width = 400;          // narrower canvas for vertical heat
                canvas.height = 1500;        // match scrollable height

                const heat = simpleheat(canvas);

                // 🔥 THIS IS WHERE YOU ADD IT
                const points = data.map(item => [
                    200,                // fixed horizontal center
                    item.scroll_depth,  // vertical scroll position
                    1                   // intensity
                ]);

                heat.data(points);
                heat.max(10);
                heat.draw();

            });

    }, [page]);

    return (
        <div style={{ padding: 20 }}>
            <h1>Scroll Heatmap</h1>

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