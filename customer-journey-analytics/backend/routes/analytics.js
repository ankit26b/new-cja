const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Funnel Stages
const stages = [
    "/product",
    "/cart",
    "/checkout",
    "/payment"
];

router.get('/funnel', authMiddleware, adminMiddleware, async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT session_id, page_url
            FROM events
            WHERE event_type = 'page_view'
        `);

        const sessionStages = {};

        result.rows.forEach(row => {
            const stageIndex = stages.indexOf(row.page_url);

            if (stageIndex !== -1) {
                if (!sessionStages[row.session_id] || stageIndex > sessionStages[row.session_id]) {
                    sessionStages[row.session_id] = stageIndex;
                }
            }
        });

        const counts = Array(stages.length).fill(0);

        Object.values(sessionStages).forEach(stageIndex => {
            for (let i = 0; i <= stageIndex; i++) {
                counts[i]++;
            }
        });

        const funnelData = stages.map((stage, index) => {

    const conversionRate = index === 0
        ? 100
        : counts[index - 1] > 0
            ? ((counts[index] / counts[index - 1]) * 100).toFixed(2)
            : 0;

    return {
        stage,
        users: counts[index],
        conversionRate: Number(conversionRate)
    };
});

        res.json(funnelData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Funnel calculation error" });
    }
});


// Heatmap API
router.get('/heatmap', authMiddleware, adminMiddleware, async (req, res) => {
    try {

        const { page } = req.query;

        if (!page) {
            return res.status(400).json({ error: "Page query param required" });
        }

        const result = await pool.query(
            `SELECT x, y
             FROM events
             WHERE event_type IN ('click', 'mousemove')
             AND page_url = $1`,
            [page]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Heatmap error" });
    }
});


router.get('/predict/:session_id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { session_id } = req.params;

        const result = await pool.query(
            `SELECT duration, total_clicks, max_scroll_depth, total_pages
             FROM sessions
             WHERE session_id = $1`,
            [session_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const session = result.rows[0];

        const mlResponse = await fetch("http://localhost:8000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                duration: parseFloat(session.duration) || 0,
                total_clicks: parseInt(session.total_clicks) || 0,
                max_scroll_depth: parseInt(session.max_scroll_depth) || 0,
                total_pages: parseInt(session.total_pages) || 0
            })
        });

        const prediction = await mlResponse.json();

        res.json(prediction);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Prediction error" });
    }
});

router.get('/scrollmap', authMiddleware, adminMiddleware, async (req, res) => {
    const { page } = req.query;

    const result = await pool.query(
        `SELECT scroll_depth
         FROM events
         WHERE event_type = 'scroll'
         AND page_url = $1`,
        [page]
    );

    res.json(result.rows);
});

//sentiments endpoint
router.post('/sentiment', authMiddleware, adminMiddleware, async (req, res) => {
    try {

        const { text } = req.body;

        const mlResponse = await fetch("http://localhost:8000/sentiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        const result = await mlResponse.json();

        res.json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Sentiment error" });
    }
});

// Time-on-page analytics
router.get('/analytics/time-on-page', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT session_id, page_url, timestamp
            FROM events
            WHERE event_type = 'page_view'
            ORDER BY session_id, timestamp ASC
        `);

        // Group by session
        const sessions = {};
        for (const row of result.rows) {
            if (!sessions[row.session_id]) sessions[row.session_id] = [];
            sessions[row.session_id].push({ page: row.page_url, ts: new Date(row.timestamp) });
        }

        // Calculate dwell times per page
        const pageDwells = {};
        const pageSessions = {};

        for (const [sessionId, views] of Object.entries(sessions)) {
            const visitedPages = new Set();
            for (let i = 0; i < views.length - 1; i++) {
                const page = views[i].page;
                const dwellSec = (views[i + 1].ts - views[i].ts) / 1000;

                if (dwellSec < 0 || dwellSec > 3600) continue; // skip invalid / >1hr outliers

                if (!pageDwells[page]) pageDwells[page] = [];
                pageDwells[page].push(dwellSec);
                visitedPages.add(page);
            }
            // Count unique sessions per page
            for (const page of visitedPages) {
                pageSessions[page] = (pageSessions[page] || 0) + 1;
            }
        }

        // Compute stats per page
        const results = Object.entries(pageDwells).map(([page, dwells]) => {
            dwells.sort((a, b) => a - b);
            const len = dwells.length;
            const sum = dwells.reduce((a, b) => a + b, 0);
            const avg = len > 0 ? sum / len : 0;
            const median = len > 0
                ? len % 2 === 0
                    ? (dwells[len / 2 - 1] + dwells[len / 2]) / 2
                    : dwells[Math.floor(len / 2)]
                : 0;
            const p90Index = Math.ceil(len * 0.9) - 1;
            const p90 = len > 0 ? dwells[Math.max(0, p90Index)] : 0;

            return {
                page,
                avg_dwell_seconds: parseFloat(avg.toFixed(2)),
                median_dwell_seconds: parseFloat(median.toFixed(2)),
                p90_dwell_seconds: parseFloat(p90.toFixed(2)),
                total_sessions: pageSessions[page] || 0
            };
        });

        results.sort((a, b) => b.avg_dwell_seconds - a.avg_dwell_seconds);

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Time-on-page calculation error" });
    }
});

// Entry & Exit Pages
router.get('/analytics/entry-exit', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT session_id, page_url, timestamp
            FROM events
            WHERE event_type = 'page_view'
            ORDER BY session_id, timestamp ASC
        `);

        if (rows.length === 0) {
            return res.json({ entryPages: [], exitPages: [] });
        }

        // Group by session
        const sessions = {};
        for (const row of rows) {
            if (!sessions[row.session_id]) sessions[row.session_id] = [];
            sessions[row.session_id].push(row);
        }

        const entryCounts = {};
        const exitCounts = {};
        const pageVisitCounts = {};

        for (const events of Object.values(sessions)) {
            const entryPage = events[0].page_url;
            const exitPage = events[events.length - 1].page_url;

            entryCounts[entryPage] = (entryCounts[entryPage] || 0) + 1;
            exitCounts[exitPage] = (exitCounts[exitPage] || 0) + 1;

            const visitedPages = new Set(events.map(e => e.page_url));
            for (const p of visitedPages) {
                pageVisitCounts[p] = (pageVisitCounts[p] || 0) + 1;
            }
        }

        const entryPages = Object.entries(entryCounts)
            .map(([page, session_count]) => ({ page, session_count }))
            .sort((a, b) => b.session_count - a.session_count);

        const exitPages = Object.entries(exitCounts)
            .map(([page, session_count]) => ({
                page,
                session_count,
                exit_rate: parseFloat(((session_count / (pageVisitCounts[page] || 1)) * 100).toFixed(1)),
            }))
            .sort((a, b) => b.session_count - a.session_count);

        res.json({ entryPages, exitPages });

    } catch (error) {
        console.error('Entry/exit error:', error);
        res.status(500).json({ error: 'Failed to compute entry/exit pages' });
    }
});

// Rage Clicks
router.get('/analytics/rage-clicks', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page } = req.query;

        const queryParams = [];
        let pageFilter = '';
        if (page) {
            queryParams.push(page);
            pageFilter = `AND page_url = $1`;
        }

        const { rows } = await pool.query(
            `SELECT session_id, page_url, x, y, timestamp
             FROM events
             WHERE event_type = 'click'
             ${pageFilter}
             ORDER BY session_id, timestamp ASC`,
            queryParams
        );

        // Group by session
        const sessions = {};
        for (const row of rows) {
            if (!sessions[row.session_id]) sessions[row.session_id] = [];
            sessions[row.session_id].push({
                page: row.page_url,
                x: parseFloat(row.x),
                y: parseFloat(row.y),
                ts: new Date(row.timestamp).getTime()
            });
        }

        // Detect rage click clusters per session
        const rawClusters = []; // { page, x, y, click_count }

        for (const clicks of Object.values(sessions)) {
            let i = 0;
            while (i < clicks.length) {
                const anchor = clicks[i];
                const cluster = [anchor];

                for (let j = i + 1; j < clicks.length; j++) {
                    const c = clicks[j];
                    if (c.page !== anchor.page) break;
                    if (c.ts - anchor.ts > 600) break;

                    const dist = Math.sqrt((c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2);
                    if (dist <= 30) {
                        cluster.push(c);
                    }
                }

                if (cluster.length >= 3) {
                    const avgX = cluster.reduce((s, c) => s + c.x, 0) / cluster.length;
                    const avgY = cluster.reduce((s, c) => s + c.y, 0) / cluster.length;
                    rawClusters.push({ page: anchor.page, x: avgX, y: avgY, click_count: cluster.length });
                    i += cluster.length;
                } else {
                    i++;
                }
            }
        }

        // Merge nearby clusters (within 40px) into zones
        const zones = [];
        for (const cluster of rawClusters) {
            const existing = zones.find(z =>
                z.page === cluster.page &&
                Math.sqrt((z.x - cluster.x) ** 2 + (z.y - cluster.y) ** 2) <= 40
            );
            if (existing) {
                // Update running average
                const total = existing.session_count;
                existing.x = (existing.x * total + cluster.x) / (total + 1);
                existing.y = (existing.y * total + cluster.y) / (total + 1);
                existing.click_count = Math.max(existing.click_count, cluster.click_count);
                existing.session_count += 1;
            } else {
                zones.push({
                    page: cluster.page,
                    x: parseFloat(cluster.x.toFixed(1)),
                    y: parseFloat(cluster.y.toFixed(1)),
                    click_count: cluster.click_count,
                    session_count: 1
                });
            }
        }

        // Round merged zone coordinates
        for (const z of zones) {
            z.x = parseFloat(z.x.toFixed(1));
            z.y = parseFloat(z.y.toFixed(1));
        }

        zones.sort((a, b) => b.session_count - a.session_count);

        res.json(zones);

    } catch (error) {
        console.error('Rage click error:', error);
        res.status(500).json({ error: 'Failed to compute rage clicks' });
    }
});

module.exports = router;