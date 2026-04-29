const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/track', async (req, res) => {
    try {
        const {
            session_id,
            event_type,
            x,
            y,
            page_url,
            scroll_depth
        } = req.body;

        if (!session_id || !event_type) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Sanitize numeric fields — browser can send floats for integer columns
        const safeX = x != null ? Math.round(x) : null;
        const safeY = y != null ? Math.round(y) : null;
        const safeScrollDepth = scroll_depth != null ? Math.round(scroll_depth) : 0;

        // Upsert session — safe against race conditions from simultaneous events
        await pool.query(
            `INSERT INTO sessions (session_id, start_time)
             VALUES ($1, NOW())
             ON CONFLICT (session_id) DO NOTHING`,
            [session_id]
        );

        // 3️⃣ Insert event
        await pool.query(
            `INSERT INTO events 
            (session_id, event_type, x, y, page_url, scroll_depth)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [session_id, event_type, safeX, safeY, page_url, safeScrollDepth]
        );

        // 4️⃣ Update click count only if click event
        if (event_type === "click") {
            await pool.query(
                `UPDATE sessions
                 SET total_clicks = total_clicks + 1
                 WHERE session_id = $1`,
                [session_id]
            );
        }

        // 5️⃣ Update max scroll depth
        if (event_type === "scroll") {
            await pool.query(
                `UPDATE sessions
                 SET max_scroll_depth = GREATEST(max_scroll_depth, $1)
                 WHERE session_id = $2`,
                [safeScrollDepth, session_id]
            );
        }

        // 6️⃣ Update total pages if page_view
        if (event_type === "page_view") {
            await pool.query(
                `UPDATE sessions
                 SET total_pages = total_pages + 1
                 WHERE session_id = $1`,
                [session_id]
            );
        }

        // 7️⃣ Update end_time
        await pool.query(
            `UPDATE sessions
             SET end_time = NOW()
             WHERE session_id = $1`,
            [session_id]
        );

        // 8️⃣ Calculate duration in seconds
        await pool.query(
            `UPDATE sessions
             SET duration = EXTRACT(EPOCH FROM (end_time - start_time))
             WHERE session_id = $1`,
            [session_id]
        );

        res.status(200).json({ message: "Event stored successfully" });

    } catch (error) {
        console.error('TRACK ERROR:', error.message, '| Body:', JSON.stringify(req.body));
        res.status(500).json({ error: "Error storing event", detail: error.message });
    }
});

module.exports = router;