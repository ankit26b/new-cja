import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_ID = window?.CJA_CONFIG?.site_id || "ecommerce_001";
const TRACK_ENDPOINT = window?.CJA_CONFIG?.track_endpoint || "http://localhost:5000/api/track";

function getOrCreateSessionId() {
  const key = `cja_session_id_${SITE_ID}`;
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: SITE_ID,
        session_id: sessionId,
        event_type: "page_view",
        x: null,
        y: null,
        page_url: location.pathname,
        scroll_depth: 0,
      }),
    }).catch(() => {});
  }, [location]);

  return null;
}
