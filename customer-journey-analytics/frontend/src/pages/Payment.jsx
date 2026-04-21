import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Payment.css";

export default function Payment() {
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // Determine the final total cost from the state that existed before checkout
    // If arriving directly, default to 0
    const items = JSON.parse(localStorage.getItem("cart")) || [];
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    setTotal(subtotal + tax);

    // Empty the cart conceptually simulating a successfully completed order
    localStorage.removeItem("cart");

    // Scroll to top immediately to ensure animations trigger in viewport
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="paymentContainer">
      <div className="successCard">
        <div className="checkmarkWrapper">
          <div className="checkmark">✔</div>
        </div>
        
        <h1>Payment Successful!</h1>
        <p>Thank you for your aesthetic purchase. A confirmation email has been sent to your inbox.</p>

        <div className="receiptDetails">
          <div className="receiptRow">
            <span>Order Number</span>
            <span style={{ color: "var(--accent)" }}>
              #ORD-{Math.floor(Math.random() * 900000) + 100000}
            </span>
          </div>
          <div className="receiptRow">
            <span>Date</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          <div className="receiptRow">
            <span>Payment Method</span>
            <span>Card ending in 4242</span>
          </div>
          <div className="receiptRow totalRow">
            <span>Amount Paid</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="actionGroup">
          <button className="secondaryBtn" onClick={() => navigate('/dashboard')}>
            View Dashboard
          </button>
          <button className="primary" onClick={() => navigate('/')}>
            Return Home
          </button>
        </div>
      </div>

      {/* Analytics deep-scroll test zone */}
      <div className="scrollArea" style={{ height: "1500px" }}>
        <p style={{ marginTop: "4rem" }}>
          Scroll tracking buffer area to test depth engagement on confirmation screens...
        </p>
      </div>
    </div>
  );
}