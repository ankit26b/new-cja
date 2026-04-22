import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="homeContainer">
      {/* Hero Section */}
      <section className="hero">
        <div className="heroBackground"></div>
        <div className="heroTopBar">
          <div className="heroAuthStatus">
            {user ? `Signed in as ${user.email}` : 'Browse the store or sign in'}
          </div>
          <div className="heroAuthActions">
            {user ? (
              <>
                {isAdmin() && (
                  <button className="secondaryBtn" onClick={() => navigate('/dashboard')}>
                    View Analytics
                  </button>
                )}
                <button className="secondaryBtn" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <button className="secondaryBtn" onClick={() => navigate('/login')}>Login</button>
                <button className="secondaryBtn" onClick={() => navigate('/register')}>Register</button>
              </>
            )}
          </div>
        </div>
        <h1 className="glowText">Aesthetic Store</h1>
        <p>Experience the next generation of online shopping. Premium products, unmatched quality, and a design that feels alive.</p>
        <div className="ctaGroup">
          <button className="primary" onClick={() => navigate('/product')}>Explore Products</button>
          {isAdmin() ? (
            <button className="secondaryBtn" onClick={() => navigate('/dashboard')}>View Analytics</button>
          ) : (
            <button className="secondaryBtn" onClick={() => navigate('/login')}>Admin Login</button>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="featuresSection">
        <h2 className="sectionTitle">Why Choose Us?</h2>
        <div className="featureGrid">
          <div className="featureCard">
            <div className="iconWrapper">✨</div>
            <h3>Premium Quality</h3>
            <p>Every product in our catalog is carefully curated to meet the highest standards of quality and aesthetics.</p>
          </div>
          <div className="featureCard">
            <div className="iconWrapper">🚀</div>
            <h3>Fast Delivery</h3>
            <p>We ensure your desired items reach you securely and swiftly with our global logistics network.</p>
          </div>
          <div className="featureCard">
            <div className="iconWrapper">💎</div>
            <h3>Exclusive Designs</h3>
            <p>Get access to rare drops and exceptional designs that you won't find anywhere else on the internet.</p>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="productsSection">
        <div className="productsContainer">
          <h2 className="sectionTitle">Trending Now</h2>
          <div className="productGrid">
            {[1, 2, 3].map((item) => (
              <div key={item} className="productCard">
                <div className="productImagePlaceholder">🛍️</div>
                <div className="productInfo">
                  <h4>Signature Hoodie V{item}</h4>
                  <p>A perfect blend of comfort and street style. Made with 100% organic cotton.</p>
                  <div className="productFooter">
                    <span className="price">${89 + item * 10}.00</span>
                    <button className="primary" onClick={() => navigate('/product')}>Buy Now</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scroll Functionality Test Area */}
      <section className="longScrollArea">
        <h2 className="sectionTitle">More to Discover</h2>
        <p style={{ color: 'var(--text-muted)' }}>Scroll completely to simulate user journey data tracking...</p>
        
        <div className="scrollItem">
          <h3>Customer Journey Tracking Active</h3>
          <p>This layout is specifically designed to have a significant vertical height. Our Customer Journey Analytics system will capture how far down the page users scroll before bouncing or converting.</p>
        </div>

        <div className="scrollItem">
          <h3>Heatmap Generation</h3>
          <p>Clicks on products, hero buttons, and time spent on different sections will be aggregated into the heatmap visualization. Head to the dashboard to see your session.</p>
        </div>
        
        <div className="scrollItem">
          <h3>Deep Engagement Zone</h3>
          <p>If you're reading this, your session duration is probably over 30 seconds and your scroll depth is near 90%. You're highly engaged!</p>
          <button className="primary" style={{marginTop: '1rem'}} onClick={() => navigate('/scroll-heatmap')}>View Scroll Heatmap</button>
        </div>
      </section>
    </div>
  );
}