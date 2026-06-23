/**
 * Shared loading skeleton for all 5 analytics panels.
 * Uses the .cja-skeleton shimmer class defined in index.css.
 */

const BASE = {
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

/** One shimmer bar */
function SkeletonBar({ width = '100%', height = 18, mb = 12 }) {
  return (
    <div
      className="cja-skeleton"
      style={{ width, height, marginBottom: mb, borderRadius: 6 }}
    />
  );
}

/** Full-panel skeleton: header + a configurable number of content rows */
export function PanelSkeleton({ rows = 5 }) {
  // Alternating widths so it looks like real content
  const widths = ['55%', '80%', '65%', '90%', '45%', '75%', '60%', '85%'];
  return (
    <div style={BASE.container}>
      {/* Fake title */}
      <SkeletonBar width="35%" height={28} mb={10} />
      {/* Fake subtitle */}
      <SkeletonBar width="55%" height={14} mb={32} />

      {/* Fake stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '20px 22px',
            }}
          >
            <SkeletonBar width="50%" height={12} mb={10} />
            <SkeletonBar width="40%" height={28} mb={6} />
            <SkeletonBar width="30%" height={12} mb={0} />
          </div>
        ))}
      </div>

      {/* Fake chart / content area */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '22px 26px',
        }}
      >
        <SkeletonBar width="30%" height={16} mb={20} />
        <SkeletonBar width="100%" height={200} mb={0} />
      </div>

      {/* Fake table rows */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '22px 26px',
          marginTop: 24,
        }}
      >
        <SkeletonBar width="25%" height={16} mb={20} />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBar
            key={i}
            width={widths[i % widths.length]}
            height={15}
            mb={14}
          />
        ))}
      </div>
    </div>
  );
}

/** Compact error banner for panel-level API failures */
export function PanelError({ message }) {
  return (
    <div style={BASE.container}>
      <div className="cja-panel-error">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {message || 'Failed to load data. Please try again.'}
      </div>
    </div>
  );
}

/** Centered empty-state message */
export function PanelEmpty({ message }) {
  return (
    <div style={BASE.container}>
      <div className="cja-panel-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
          <path d="M3 3h18v18H3z" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span>{message || 'No data recorded yet for this site.'}</span>
      </div>
    </div>
  );
}
