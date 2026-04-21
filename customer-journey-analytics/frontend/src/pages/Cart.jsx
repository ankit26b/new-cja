import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Cart.css";

export default function Cart() {
  const [cartItems, setCartItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("cart")) || [];
    setCartItems(items);
  }, []);

  const updateQuantity = (id, change) => {
    const updatedItems = cartItems.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + change) };
      }
      return item;
    });
    setCartItems(updatedItems);
    localStorage.setItem("cart", JSON.stringify(updatedItems));
  };

  const removeItem = (id) => {
    const updatedItems = cartItems.filter(item => item.id !== id);
    setCartItems(updatedItems);
    localStorage.setItem("cart", JSON.stringify(updatedItems));
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="cartContainer">
      <div className="cartHeader">
        <h1>Your Cart</h1>
        <span className="itemCount">{cartItems.length} Items</span>
      </div>

      {cartItems.length === 0 ? (
        <div className="emptyCart">
          <h2>Your cart is empty</h2>
          <p>Discover our latest premium products.</p>
          <button className="primary" style={{marginTop: "2rem"}} onClick={() => navigate('/product')}>
            Start Shopping
          </button>
        </div>
      ) : (
        <>
          <div className="cartItems">
            {cartItems.map(item => (
              <div key={item.id} className="cartItemCard">
                <div className="cartItemImage">{item.image}</div>
                <div className="cartItemDetails">
                  <h3>{item.name}</h3>
                  <div className="cartItemPrice">${item.price.toFixed(2)}</div>
                </div>
                <div className="cartItemActions">
                  <button className="qtyBtn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                  <span className="qtyValue">{item.quantity}</span>
                  <button className="qtyBtn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                  <button className="removeBtn" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="cartSummary">
             <div className="summaryRow">
               <span>Subtotal</span>
               <span>${subtotal.toFixed(2)}</span>
             </div>
             <div className="summaryRow">
               <span>Shipping</span>
               <span>Free</span>
             </div>
             <div className="summaryRow total">
               <span>Total</span>
               <span>${subtotal.toFixed(2)}</span>
             </div>
             <button className="primary checkoutBtn" onClick={() => navigate('/checkout')}>
               Proceed to Checkout
             </button>
          </div>
        </>
      )}

      {/* Padding space to simulate scroll depth tracking if needed */}
      <div style={{height: "300px"}} />
    </div>
  );
}