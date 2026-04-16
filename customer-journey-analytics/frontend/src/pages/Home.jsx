import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{padding: "40px"}}>
      <h1>Welcome to Store</h1>
      <Link to="/product">Go to Product</Link>

      <div style={{height: "1500px"}}>
        <p>Scroll down to simulate engagement...</p>
      </div>
    </div>
  );
}