import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';

export default function SiteSelector() {
  const { isMasterAdmin } = useAuth();
  const {
    currentSiteId,
    setCurrentSiteId,
    availableSites,
    loadingSites,
    sitesError,
  } = useSite();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
      <label htmlFor="site-selector" style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
        Client Site
      </label>
      <select
        id="site-selector"
        value={currentSiteId || ''}
        onChange={(event) => setCurrentSiteId(event.target.value)}
        disabled={loadingSites || availableSites.length === 0 || !isMasterAdmin()}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: '#fff',
          color: '#0f172a',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {loadingSites && <option value="">Loading sites...</option>}
        {!loadingSites && availableSites.length === 0 && <option value="">No client sites assigned</option>}
        {!loadingSites && availableSites.map((site) => (
          <option key={site.site_id} value={site.site_id}>
            {site.display_name}
          </option>
        ))}
      </select>
      {sitesError ? <span style={{ color: '#dc2626', fontSize: 12 }}>{sitesError}</span> : null}
    </div>
  );
}
