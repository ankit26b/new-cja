import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./Checkout.css";

export default function Checkout() {
  const [text, setText] = useState("");
  const [cartTotal, setCartTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("cart")) || [];
    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    setCartTotal(total);
  }, []);

  return (
    <div className="checkoutContainer">
      <div className="checkoutHeader">
        <h1>Secure Checkout</h1>
        <p>Almost there! Please provide your details below.</p>
      </div>

      <div className="checkoutLayout">
        <div className="checkoutForms">
          <section className="checkoutSection">
            <h2>Shipping Information</h2>
            <form className="formGrid">
              <div className="formGroup">
                <label>First Name</label>
                <input type="text" className="formInput" placeholder="John" />
              </div>
              <div className="formGroup">
                <label>Last Name</label>
                <input type="text" className="formInput" placeholder="Doe" />
              </div>
              <div className="formGroup fullWidth">
                <label>Address</label>
                <input type="text" className="formInput" placeholder="123 Aesthetic Avenue" />
              </div>
              <div className="formGroup">
                <label>City</label>
                <input type="text" className="formInput" placeholder="Metropolis" />
              </div>
              <div className="formGroup">
                <label>Zip Code</label>
                <input type="text" className="formInput" placeholder="10001" />
              </div>
            </form>
          </section>

          <section className="checkoutSection">
            <h2>Order Note / Feedback</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
              Leave a note for your order.
            </p>
            <div className="formGroup fullWidth">
              <textarea
                className="formTextarea"
                placeholder="I am really excited to try out these headphones! The design is amazing..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </section>
        </div>

        <div className="checkoutSidebar">
          <div className="summaryCard">
            <h2>Order Summary</h2>
            <div className="summaryItem">
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <div className="summaryItem">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="summaryItem">
              <span>Taxes</span>
              <span>${(cartTotal * 0.08).toFixed(2)}</span> {/* Assuming 8% tax */}
            </div>
            <div className="summaryTotal">
              <span>Total</span>
              <span>${(cartTotal + (cartTotal * 0.08)).toFixed(2)}</span>
            </div>
            <button className="primary proceedBtn" onClick={() => navigate('/payment')}>
              Continue to Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}