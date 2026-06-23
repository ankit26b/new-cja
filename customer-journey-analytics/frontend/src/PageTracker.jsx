import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSite } from "./context/SiteContext";

function getOrCreateSessionId(siteId) {
  const sessionKey = `cja_session_id_${siteId}`;
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(sessionKey, sessionId);
  }
  sessionStorage.setItem("cja_session_id", sessionId);
  return sessionId;
}

function PageTracker() {
  const location = useLocation();
  const { currentSiteId } = useSite();

  useEffect(() => {
    if (!currentSiteId) return;

    const sessionId = getOrCreateSessionId(currentSiteId);

    fetch("http://localhost:5000/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        site_id: currentSiteId,
        session_id: sessionId,
        event_type: "page_view",
        x: null,
        y: null,
        page_url: location.pathname,
        scroll_depth: 0
      })
    }).catch(err => console.error(err));

  }, [location, currentSiteId]);

  return null;
}

export default PageTracker;