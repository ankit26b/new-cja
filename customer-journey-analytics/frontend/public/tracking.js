(function () {

    // Generate or reuse session ID
    function getSessionId() {
        let sessionId = sessionStorage.getItem("cja_session_id");

        if (!sessionId) {
            sessionId = crypto.randomUUID();
            sessionStorage.setItem("cja_session_id", sessionId);
        }

        return sessionId;
    }

    const sessionId = getSessionId();

    // Send event to backend
    function sendEvent(data) {
        fetch("http://localhost:5000/api/track", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }).catch(err => console.error("Tracking error:", err));
    }

    // Track Clicks
    document.addEventListener("click", function (event) {
        sendEvent({
            session_id: sessionId,
            event_type: "click",
            x: event.clientX,
            y: event.clientY,
            page_url: window.location.pathname,
            scroll_depth: window.scrollY
        });
    });

    // Track Scroll (throttled)
    let lastScroll = 0;

    window.addEventListener("scroll", function () {
        if (Math.abs(window.scrollY - lastScroll) > 100) {
            lastScroll = window.scrollY;

            sendEvent({
                session_id: sessionId,
                event_type: "scroll",
                x: null,
                y: null,
                page_url: window.location.pathname,
                scroll_depth: window.scrollY
            });
        }
    });

})();