import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const SiteContext = createContext(null);
const LOCAL_STORAGE_KEY = 'cja_current_site_id';

export function SiteProvider({ children }) {
  const { token, isMasterAdmin } = useAuth();
  const [availableSites, setAvailableSites] = useState([]);
  const [currentSiteId, setCurrentSiteId] = useState(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState('');

  useEffect(() => {
    if (!token) {
      setAvailableSites([]);
      setCurrentSiteId(null);
      setLoadingSites(false);
      setSitesError('');
      return;
    }

    const controller = new AbortController();
    setLoadingSites(true);
    setSitesError('');

    fetch('http://localhost:5000/api/sites', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch sites: ${res.status}`);
        }
        return res.json();
      })
      .then((sites) => {
        const normalizedSites = Array.isArray(sites) ? sites : [];
        setAvailableSites(normalizedSites);

        const persisted = localStorage.getItem(LOCAL_STORAGE_KEY);
        const persistedExists = normalizedSites.some((site) => site.site_id === persisted);

        if (isMasterAdmin() && persisted && persistedExists) {
          setCurrentSiteId(persisted);
          return;
        }

        if (normalizedSites.length > 0) {
          const fallbackSite = normalizedSites[0].site_id;
          setCurrentSiteId(fallbackSite);
          localStorage.setItem(LOCAL_STORAGE_KEY, fallbackSite);
        } else {
          setCurrentSiteId(null);
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setSitesError(error.message || 'Failed to load sites');
        setAvailableSites([]);
        setCurrentSiteId(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSites(false);
        }
      });

    return () => controller.abort();
  }, [token, isMasterAdmin]);

  const handleSetCurrentSiteId = (siteId) => {
    if (!isMasterAdmin()) {
      return;
    }
    setCurrentSiteId(siteId);
    if (siteId) {
      localStorage.setItem(LOCAL_STORAGE_KEY, siteId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const value = useMemo(
    () => ({
      currentSiteId,
      setCurrentSiteId: handleSetCurrentSiteId,
      availableSites,
      loadingSites,
      sitesError,
    }),
    [currentSiteId, availableSites, loadingSites, sitesError]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
}
