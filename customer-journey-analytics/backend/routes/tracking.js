const express = require('express');
const router = express.Router();
const pool = require('../config/db');
// Multi-tenant: import requireSiteId middleware
const { requireSiteId } = require('../middleware/auth');

async function processEvent(site_id, trackedEvent) {
    const session_id = trackedEvent.session_id;
    const event_type = trackedEvent.event_type;
    const x = trackedEvent.x;
    const y = trackedEvent.y;
    const page_url = trackedEvent.page_url || trackedEvent.page;
    const scroll_depth = trackedEvent.scroll_depth;

    if (!session_id || !event_type) {
        throw new Error('Missing required event fields: session_id or event_type');
    }

    // Sanitize numeric fields — browser can send floats for integer columns
    const safeX = x != null ? Math.round(x) : null;
    const safeY = y != null ? Math.round(y) : null;
    const safeScrollDepth = scroll_depth != null ? Math.round(scroll_depth) : 0;

    // Upsert session — includes site_id for multi-tenant isolation
    await pool.query(
        `INSERT INTO sessions (session_id, site_id, start_time)
         VALUES ($1, $2, NOW())
         ON CONFLICT (session_id) DO NOTHING`,
        [session_id, site_id]
    );

    // Insert event — tagged with site_id
    await pool.query(
        `INSERT INTO events
        (session_id, event_type, x, y, page_url, scroll_depth, site_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [session_id, event_type, safeX, safeY, page_url, safeScrollDepth, site_id]
    );

    // Update click count only if click event
    if (event_type === "click") {
        await pool.query(
            `UPDATE sessions
             SET total_clicks = total_clicks + 1
             WHERE session_id = $1 AND site_id = $2`,
            [session_id, site_id]
        );
    }

    // Update max scroll depth
    if (event_type === "scroll") {
        await pool.query(
            `UPDATE sessions
             SET max_scroll_depth = GREATEST(max_scroll_depth, $1)
             WHERE session_id = $2 AND site_id = $3`,
            [safeScrollDepth, session_id, site_id]
        );
    }

    // Update total pages if page_view
    if (event_type === "page_view") {
        await pool.query(
            `UPDATE sessions
             SET total_pages = total_pages + 1
             WHERE session_id = $1 AND site_id = $2`,
            [session_id, site_id]
        );
    }

    // Update end_time — scoped to site_id
    await pool.query(
        `UPDATE sessions
         SET end_time = NOW()
         WHERE session_id = $1 AND site_id = $2`,
        [session_id, site_id]
    );

    // Calculate duration in seconds — scoped to site_id
    await pool.query(
        `UPDATE sessions
         SET duration = EXTRACT(EPOCH FROM (end_time - start_time))
         WHERE session_id = $1 AND site_id = $2`,
        [session_id, site_id]
    );
}

// requireSiteId ensures req.siteId is populated before the handler runs
router.post('/track', requireSiteId, async (req, res) => {
    try {
        // site_id is validated & normalised by the requireSiteId middleware
        const site_id = req.siteId;

        const incomingEvents = Array.isArray(req.body.events) ? req.body.events : [req.body];
        if (incomingEvents.length === 0) {
            return res.status(400).json({ error: "No events to process" });
        }

        for (const trackedEvent of incomingEvents) {
            await processEvent(site_id, trackedEvent);
        }

        res.status(200).json({
            message: "Event(s) stored successfully",
            processed: incomingEvents.length
        });

    } catch (error) {
        console.error('TRACK ERROR:', error.message, '| Body:', JSON.stringify(req.body));
        res.status(500).json({ error: "Error storing event", detail: error.message });
    }
});

module.exports = router;