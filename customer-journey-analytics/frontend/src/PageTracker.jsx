import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem("cja_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("cja_session_id", sessionId);
  }
  return sessionId;
}

function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    const sessionId = getOrCreateSessionId();

    fetch("http://localhost:5000/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: "page_view",
        x: null,
        y: null,
        page_url: location.pathname,
        scroll_depth: 0
      })
    }).catch(err => console.error(err));

  }, [location]);

  return null;
}

export default PageTracker;