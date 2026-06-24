import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Payment.css";

export default function Payment() {
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("cart")) || [];
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;
    setTotal(subtotal + tax);
    localStorage.removeItem("cart");
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
          <a
            className="secondaryBtn"
            href="http://localhost:5173/dashboard"
            target="_blank"
            rel="noreferrer"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'1.2rem', fontSize:'1.15rem', flex:1, borderRadius:'var(--radius-md)', border:'1px solid var(--border)', color:'var(--text-primary)', fontWeight:600, textDecoration:'none' }}
          >
            View Dashboard ↗
          </a>
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
