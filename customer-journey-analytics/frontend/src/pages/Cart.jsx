import { Link } from "react-router-dom";

export default function Cart() {
  return (
    <div style={{padding: "40px"}}>
      <h1>Cart Page</h1>
      <Link to="/checkout">Proceed to Checkout</Link>

      <div style={{height: "1500px"}} />
    </div>
  );
}