import { Routes, Route } from "react-router-dom";
import PageTracker from "./PageTracker";
import Heatmap from "./pages/Heatmap";
import ScrollHeatmap from "./pages/ScrollHeatmap";

import Home from "./pages/Home";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <>
      <PageTracker />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/dashboard" element={<Dashboard/>} />

        <Route path="/heatmap" element={<Heatmap />} />
        
        <Route path="/scroll-heatmap" element={<ScrollHeatmap />} />
      </Routes>
    </>
    
  );
}

export default App;