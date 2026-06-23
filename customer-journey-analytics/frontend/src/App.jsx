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
import TimeOnPage from "./pages/TimeOnPage";
import EntryExit from "./pages/EntryExit";
import RageClicks from "./pages/RageClicks";
import NavPaths from "./pages/NavPaths";
import ConversionInfluencer from "./pages/ConversionInfluencer";
import EngagementScores from "./pages/EngagementScores";
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

        {/* Analytics Protected Routes (all authenticated business users + master admin) */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/heatmap" element={
          <ProtectedRoute>
            <Heatmap />
          </ProtectedRoute>
        } />
        <Route path="/scroll-heatmap" element={
          <ProtectedRoute>
            <ScrollHeatmap />
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute adminOnly>
            <UserManagement />
          </ProtectedRoute>
        } />
        <Route path="/time-on-page" element={
          <ProtectedRoute>
            <TimeOnPage />
          </ProtectedRoute>
        } />
        <Route path="/entry-exit" element={
          <ProtectedRoute>
            <EntryExit />
          </ProtectedRoute>
        } />
        <Route path="/rage-clicks" element={
          <ProtectedRoute>
            <RageClicks />
          </ProtectedRoute>
        } />
        <Route path="/nav-paths" element={
          <ProtectedRoute>
            <NavPaths />
          </ProtectedRoute>
        } />
        <Route path="/conversion-influence" element={
          <ProtectedRoute>
            <ConversionInfluencer />
          </ProtectedRoute>
        } />
        <Route path="/engagement-scores" element={
          <ProtectedRoute>
            <EngagementScores />
          </ProtectedRoute>
        } />
      </Routes>
    </>
    
  );
}

export default App;