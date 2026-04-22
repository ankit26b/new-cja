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
            body: JSON.stringify(session)
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

module.exports = router;