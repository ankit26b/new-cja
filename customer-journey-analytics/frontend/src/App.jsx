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
import Login from "./pages/Login";
import Register from "./pages/Register";
import SetupAdmin from "./pages/SetupAdmin";
import UserManagement from "./pages/UserManagement";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <PageTracker />

      <Routes>
        {/* Public Store Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/product" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<Payment />} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-admin" element={<SetupAdmin />} />

        {/* Admin Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute adminOnly>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/heatmap" element={
          <ProtectedRoute adminOnly>
            <Heatmap />
          </ProtectedRoute>
        } />
        <Route path="/scroll-heatmap" element={
          <ProtectedRoute adminOnly>
            <ScrollHeatmap />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute adminOnly>
            <UserManagement />
          </ProtectedRoute>
        } />
      </Routes>
    </>
    
  );
}

export default App;