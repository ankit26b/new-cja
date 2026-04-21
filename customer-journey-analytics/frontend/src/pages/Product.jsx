import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import simpleheat from "simpleheat";
import "./Product.css";

export default function Product() {
  const [addedMessage, setAddedMessage] = useState("");

  const handleAddToCart = () => {
    const product = {
      id: "aesthetic-headphones",
      name: "Aesthetic Wireless Over-Ear Headphones",
      price: 299,
      quantity: 1,
      image: "🎧"
    };

    const existingCart = JSON.parse(localStorage.getItem("cart")) || [];
    const existingItemIndex = existingCart.findIndex(item => item.id === product.id);

    if (existingItemIndex >= 0) {
      existingCart[existingItemIndex].quantity += 1;
    } else {
      existingCart.push(product);
    }

    localStorage.setItem("cart", JSON.stringify(existingCart));
    setAddedMessage("Added to Cart!");
    setTimeout(() => setAddedMessage(""), 2000);
  };

  useEffect(() => {
    const canvas = document.getElementById("heatmapCanvas");
    if (!canvas) return;

    // Wait a tick for the DOM to fully render the CSS dimensions
    setTimeout(() => {
      canvas.width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
      canvas.height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

      const heat = simpleheat(canvas);

      fetch("http://localhost:5000/api/heatmap?page=/product")
        .then(res => res.json())
        .then(data => {
          if(!data || data.length === 0) return;
          const points = data.map(point => [
            point.x,
            point.y,
            1
          ]);

          heat.data(points);
          heat.max(5);
          heat.draw();
        })
        .catch(err => console.error("Could not load heatmap data:", err));
    }, 100);

  }, []);

  return (
    <div id="productContainer" className="productPageContainer">
      <div className="productLayout">
        {/* Product Image Gallery */}
        <div className="imageGallery">
          <div className="imagePlaceholder">🎧</div>
        </div>

        {/* Product Details */}
        <div className="productDetails">
          <div className="badge">Limited Edition</div>
          <h1 className="productTitle">Aesthetic Wireless Over-Ear Headphones</h1>
          
          <div className="productPrice">
            <span>$299.00</span>
            <span className="oldPrice">$399.00</span>
          </div>
          
          <p className="productDescription">
            Experience spatial audio like never before. Crafted with premium aerospace-grade aluminum and 
            memory foam cushions, these headphones deliver an immersive soundscape housed within an 
            iconic, minimalist design. 
          </p>

          <div className="actions">
            <button className="primary cartBtn" onClick={handleAddToCart}>
              {addedMessage || "Add to Cart"}
            </button>
            <Link to="/cart" className="secondaryLink">View Cart</Link>
          </div>

          <div className="productSpecs">
            <div className="specItem">
              <h4>Battery</h4>
              <p>Up to 40 hours</p>
            </div>
            <div className="specItem">
              <h4>Noise Cancel</h4>
              <p>Active (ANC)</p>
            </div>
            <div className="specItem">
              <h4>Connectivity</h4>
              <p>Bluetooth 5.3</p>
            </div>
          </div>
        </div>
      </div>

      {/* Long Scroll Section for Reviews (Tests Journey Analytics) */}
      <div className="reviewsSection">
        <h2>Customer Reviews</h2>
        <p>Keep scrolling to read what our community has to say. (This extended height helps test scroll map tracking)</p>
        
        <div className="reviewItem">
          <h5>⭐⭐⭐⭐⭐ - "Absolutely breathtaking design"</h5>
          <p>By far the most comfortable headphones I've ever worn. The dark theme aesthetic matches perfectly with the rest of my setup.</p>
        </div>
        
        <div className="reviewItem">
          <h5>⭐⭐⭐⭐⭐ - "Incredible ANC"</h5>
          <p>I wear these on flights and in the office. They drown out everything. Perfect score from me.</p>
        </div>

        <div className="reviewItem" style={{marginTop: '400px'}}>
          <h5>⭐⭐⭐⭐ - "Great, but pricey"</h5>
          <p>You definitely pay a premium for the aesthetic, but the audio quality justifies the cost. Love the deep bass.</p>
        </div>

        <div className="reviewItem" style={{marginTop: '400px'}}>
          <h5>⭐⭐⭐⭐⭐ - "Worth every penny"</h5>
          <p>I just kept scrolling and scrolling and the battery never died! A true testament to the 40hr lifespan.</p>
        </div>
      </div>

      {/* Heatmap Canvas Overlay */}
      <canvas
        id="heatmapCanvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 9999,
          pointerEvents: "none"
        }}
      />
    </div>
  );
}