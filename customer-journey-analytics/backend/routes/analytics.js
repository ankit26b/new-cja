const express = require('express');
const router = express.Router();
const pool = require('../config/db');
// Multi-tenant: import requireSiteId alongside existing auth middleware
const { authMiddleware, requireAuthorizedSiteId, isMasterAdmin, getAllowedSiteIdsForUser } = require('../middleware/auth');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Sites list for tenant selector (master admin: all, business users: assigned only)
router.get('/sites', authMiddleware, async (req, res) => {
    try {
        const tableCheck = await pool.query(`SELECT to_regclass('public.sites') AS table_name`);
        const hasSitesTable = !!tableCheck.rows[0]?.table_name;

        let allowedSiteIds = null;
        if (!isMasterAdmin(req.user)) {
            allowedSiteIds = await getAllowedSiteIdsForUser(req.user.id);
            if (allowedSiteIds.length === 0) {
                return res.json([]);
            }
        }

        if (hasSitesTable) {
            const sitesResult = await pool.query(
                `
                WITH configured_sites AS (
                    SELECT site_id, display_name
                    FROM sites
                    ${allowedSiteIds ? 'WHERE site_id = ANY($1)' : ''}
                ),
                discovered_site_ids AS (
                    SELECT DISTINCT site_id
                    FROM (
                        SELECT site_id FROM events
                        UNION
                        SELECT site_id FROM sessions
                        UNION
                        SELECT site_id FROM session_features
                    ) all_sites
                    WHERE site_id IS NOT NULL
                      AND TRIM(site_id) <> ''
                      ${allowedSiteIds ? 'AND site_id = ANY($1)' : ''}
                      AND NOT EXISTS (
                          SELECT 1
                          FROM sites s
                          WHERE s.site_id = all_sites.site_id
                      )
                ),
                discovered_sites AS (
                    SELECT
                        site_id,
                        INITCAP(REPLACE(site_id, '_', ' ')) AS display_name
                    FROM discovered_site_ids
                )
                SELECT site_id, display_name FROM configured_sites
                UNION ALL
                SELECT site_id, display_name FROM discovered_sites
                ORDER BY display_name ASC
            `,
                allowedSiteIds ? [allowedSiteIds] : []
            );
            return res.json(sitesResult.rows);
        }

        const fallbackResult = await pool.query(
            `
            SELECT DISTINCT site_id,
                INITCAP(REPLACE(site_id, '_', ' ')) AS display_name
            FROM events
            WHERE site_id IS NOT NULL AND TRIM(site_id) <> ''
              ${allowedSiteIds ? 'AND site_id = ANY($1)' : ''}
            ORDER BY display_name ASC
        `,
            allowedSiteIds ? [allowedSiteIds] : []
        );

        return res.json(fallbackResult.rows);
    } catch (error) {
        console.error('Sites list error:', error);
        return res.status(500).json({ error: 'Failed to fetch sites' });
    }
});

// Funnel Stages — per-site configuration
// Each stage can be an exact path or end with '/' for prefix matching (e.g. '/book/' matches '/book/101')
const SITE_FUNNELS = {
    ecommerce_001: ["/products", "/cart", "/checkout", "/order-complete"],
    demo_bookstore_002: ["/book/", "/cart", "/checkout", "/order-confirmed"],
};
const DEFAULT_FUNNEL = ["/products", "/cart", "/checkout", "/order-complete"];

function getFunnelStages(siteId) {
    return SITE_FUNNELS[siteId] || DEFAULT_FUNNEL;
}

function matchFunnelStage(pageUrl, stages) {
    // Normalize trailing slash from page_url for comparison
    const norm = pageUrl.endsWith('/') ? pageUrl.slice(0, -1) : pageUrl;
    for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (stage.endsWith('/')) {
            // Prefix match: '/book/' matches '/book/101', '/book/abc', etc.
            const prefix = stage.slice(0, -1); // '/book'
            if (norm === prefix || norm.startsWith(stage)) return i;
        } else {
            // Exact match (trailing-slash tolerant)
            if (norm === stage) return i;
        }
    }
    return -1;
}

// Multi-tenant: requireSiteId ensures site_id query param is present
router.get('/funnel', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        // Filter events by site_id for tenant isolation
        const site_id = req.siteId;
        const stages = getFunnelStages(site_id);

        const result = await pool.query(`
            SELECT session_id, page_url
            FROM events
            WHERE event_type = 'page_view'
              AND site_id = $1
        `, [site_id]);

        const sessionStages = {};

        result.rows.forEach(row => {
            const stageIndex = matchFunnelStage(row.page_url, stages);

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
// Multi-tenant: filter heatmap data by site_id
router.get('/heatmap', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {

        const { page } = req.query;
        const site_id = req.siteId;

        if (!page) {
            return res.status(400).json({ error: "Page query param required" });
        }

        // Normalize: match with or without trailing slash so "/cart" finds "/cart/" data and vice-versa
        const pageNorm = page.endsWith('/') ? page.slice(0, -1) : page;
        const pageWithSlash = pageNorm + '/';

        const result = await pool.query(
            `SELECT x, y
             FROM events
             WHERE event_type IN ('click', 'mousemove', 'mouse_move')
             AND (page_url = $1 OR page_url = $3)
             AND site_id = $2`,
            [pageNorm, site_id, pageWithSlash]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Heatmap error" });
    }
});


// Multi-tenant: filter prediction lookup by site_id
router.get('/predict/:session_id', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const { session_id } = req.params;
        const site_id = req.siteId;

        const result = await pool.query(
            `SELECT duration, total_clicks, max_scroll_depth, total_pages
             FROM sessions
             WHERE session_id = $1 AND site_id = $2`,
            [session_id, site_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Session not found" });
        }

        const session = result.rows[0];

        // Fetch normalization maxima and session scroll depth for engagement score
        // Multi-tenant: scope aggregation to current site_id
        const maxResult = await pool.query(
            `SELECT
               COALESCE(MAX(session_duration), 1) AS max_duration,
               COALESCE(MAX(total_clicks), 1) AS max_clicks
             FROM session_features
             WHERE site_id = $1`,
            [site_id]
        );
        const sfResult = await pool.query(
            `SELECT avg_scroll_depth, session_duration, total_clicks
             FROM session_features WHERE session_id = $1 AND site_id = $2`,
            [session_id, site_id]
        );

        let engagement_score = 0;
        if (maxResult.rows.length > 0 && sfResult.rows.length > 0) {
            const sf = sfResult.rows[0];
            const maxDur = Number(maxResult.rows[0].max_duration) || 1;
            const maxClk = Number(maxResult.rows[0].max_clicks) || 1;
            const normDuration = (Number(sf.session_duration) / maxDur) * 100;
            const normClicks  = (Number(sf.total_clicks)      / maxClk) * 100;
            engagement_score = Number(
                (Number(sf.avg_scroll_depth) * 0.40 + normDuration * 0.35 + normClicks * 0.25).toFixed(2)
            );
        }

        const mlResponse = await fetch(`${ML_URL}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                duration: parseFloat(session.duration) || 0,
                total_clicks: parseInt(session.total_clicks) || 0,
                max_scroll_depth: parseInt(session.max_scroll_depth) || 0,
                total_pages: parseInt(session.total_pages) || 0,
                engagement_score
            })
        });

        const prediction = await mlResponse.json().catch(() => null);
        if (!mlResponse.ok) {
            const upstreamError = prediction?.error || `ML service responded with ${mlResponse.status}`;
            return res.status(500).json({ error: `Prediction error: ${upstreamError}` });
        }

        if (!prediction || prediction.drop_off_probability === undefined) {
            return res.status(500).json({ error: "Prediction error: Invalid response from ML service" });
        }

        res.json(prediction);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Prediction error" });
    }
});

// Multi-tenant: filter scrollmap data by site_id
router.get('/scrollmap', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    const { page } = req.query;
    const site_id = req.siteId;

    const pageNorm = page.endsWith('/') ? page.slice(0, -1) : page;
    const pageWithSlash = pageNorm + '/';

    const result = await pool.query(
        `SELECT scroll_depth
         FROM events
         WHERE event_type = 'scroll'
         AND (page_url = $1 OR page_url = $3)
         AND site_id = $2`,
        [pageNorm, site_id, pageWithSlash]
    );

    res.json(result.rows);
});

// Dynamic page list — returns distinct tracked pages for a site (for dropdown menus)
router.get('/analytics/pages', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;
        const result = await pool.query(
            `SELECT DISTINCT page_url
             FROM events
             WHERE site_id = $1
               AND page_url IS NOT NULL
               AND TRIM(page_url) <> ''
             ORDER BY page_url ASC`,
            [site_id]
        );
        res.json(result.rows.map(r => r.page_url));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

//sentiments endpoint
// Sentiment analysis — no DB query, but requireSiteId enforces tenant context
router.post('/sentiment', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {

        const { text } = req.body;

                const mlResponse = await fetch(`${ML_URL}/sentiment`, {
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
// Multi-tenant: filter time-on-page by site_id
router.get('/analytics/time-on-page', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        const result = await pool.query(`
            SELECT session_id, page_url, timestamp
            FROM events
            WHERE event_type = 'page_view'
              AND site_id = $1
            ORDER BY session_id, timestamp ASC
        `, [site_id]);

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
// Multi-tenant: filter entry-exit by site_id
router.get('/analytics/entry-exit', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        const { rows } = await pool.query(`
            SELECT session_id, page_url, timestamp
            FROM events
            WHERE event_type = 'page_view'
              AND site_id = $1
            ORDER BY session_id, timestamp ASC
        `, [site_id]);

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
// Multi-tenant: filter rage-clicks by site_id
router.get('/analytics/rage-clicks', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const { page } = req.query;
        const site_id = req.siteId;

        // Build parameterized query — site_id is always param $1
        const queryParams = [site_id];
        let pageFilter = '';
        if (page) {
            queryParams.push(page);
            pageFilter = `AND page_url = $2`;
        }

        const { rows } = await pool.query(
            `SELECT session_id, page_url, x, y, timestamp
             FROM events
             WHERE event_type = 'click'
             AND site_id = $1
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

// Customer-facing pages only (exclude admin/analytics pages)
const CUSTOMER_PAGES = ['/', '/product', '/cart', '/checkout', '/payment'];

// Navigation Paths
// Multi-tenant: filter nav-paths by site_id
router.get('/nav-paths', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const site_id = req.siteId;

        const result = await pool.query(`
            SELECT session_id, page_url, timestamp
            FROM events
            WHERE event_type = 'page_view'
              AND page_url = ANY($1)
              AND site_id = $2
            ORDER BY session_id, timestamp
        `, [CUSTOMER_PAGES, site_id]);

        // Group pages by session in visit order
        const sessions = {};
        result.rows.forEach(row => {
            if (!sessions[row.session_id]) {
                sessions[row.session_id] = [];
            }
            sessions[row.session_id].push(row.page_url);
        });

        // Build path strings and count occurrences
        const pathCounts = {};
        let totalSessions = 0;
        let convertedSessions = 0;

        Object.values(sessions).forEach(pages => {
            totalSessions++;
            const pathStr = pages.join(' → ');
            pathCounts[pathStr] = (pathCounts[pathStr] || 0) + 1;

            if (pages.includes('/payment')) {
                convertedSessions++;
            }
        });

        // Sort by session_count descending and take top N
        const paths = Object.entries(pathCounts)
            .map(([path, session_count]) => ({
                path,
                session_count,
                converted: path.includes('/payment')
            }))
            .sort((a, b) => b.session_count - a.session_count)
            .slice(0, limit);

        const totalUniquePaths = Object.keys(pathCounts).length;
        const mostCommonPath = paths.length > 0 ? paths[0].path : null;
        const conversionRate = totalSessions > 0
            ? parseFloat(((convertedSessions / totalSessions) * 100).toFixed(2))
            : 0;

        res.json({
            paths,
            summary: {
                total_unique_paths: totalUniquePaths,
                most_common_path: mostCommonPath,
                conversion_rate: conversionRate
            }
        });

    } catch (error) {
        console.error('Nav paths error:', error);
        res.status(500).json({ error: 'Failed to compute navigation paths' });
    }
});

// Conversion Influence
// Multi-tenant: filter conversion-influence by site_id
router.get('/conversion-influence', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        // Fetch sessions with their conversion status — scoped to site_id
        const result = await pool.query(`
            SELECT
                s.session_id,
                COALESCE(s.total_clicks, 0)       AS total_clicks,
                COALESCE(s.max_scroll_depth, 0)    AS avg_scroll_depth,
                COALESCE(s.duration, 0)            AS session_duration,
                COALESCE(s.total_pages, 0)         AS pages_visited,
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM events e
                        WHERE e.session_id = s.session_id
                          AND e.page_url = '/payment'
                          AND e.event_type = 'page_view'
                          AND e.site_id = $1
                    ) THEN true
                    ELSE false
                END AS converted
            FROM sessions s
            WHERE s.duration IS NOT NULL
              AND s.site_id = $1
        `, [site_id]);

        const metrics = ['total_clicks', 'avg_scroll_depth', 'session_duration', 'pages_visited'];

        const groups = { converted: [], dropped: [] };
        result.rows.forEach(row => {
            const bucket = row.converted ? 'converted' : 'dropped';
            groups[bucket].push({
                total_clicks:     parseFloat(row.total_clicks),
                avg_scroll_depth: parseFloat(row.avg_scroll_depth),
                session_duration: parseFloat(row.session_duration),
                pages_visited:    parseFloat(row.pages_visited),
            });
        });

        function avg(arr, key) {
            if (arr.length === 0) return 0;
            return arr.reduce((s, r) => s + r[key], 0) / arr.length;
        }

        function median(arr, key) {
            if (arr.length === 0) return 0;
            const sorted = arr.map(r => r[key]).sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }

        function buildStats(arr) {
            return {
                count:        arr.length,
                avg_clicks:   parseFloat(avg(arr, 'total_clicks').toFixed(2)),
                avg_scroll:   parseFloat(avg(arr, 'avg_scroll_depth').toFixed(2)),
                avg_duration: parseFloat(avg(arr, 'session_duration').toFixed(2)),
                avg_pages:    parseFloat(avg(arr, 'pages_visited').toFixed(2)),
                median_clicks:   parseFloat(median(arr, 'total_clicks').toFixed(2)),
                median_scroll:   parseFloat(median(arr, 'avg_scroll_depth').toFixed(2)),
                median_duration: parseFloat(median(arr, 'session_duration').toFixed(2)),
                median_pages:    parseFloat(median(arr, 'pages_visited').toFixed(2)),
            };
        }

        const converted = buildStats(groups.converted);
        const dropped   = buildStats(groups.dropped);

        // Generate insights where converted avg is >50% higher than dropped avg
        const metricLabels = {
            total_clicks:     { avgKey: 'avg_clicks',   verb: 'clicked' },
            avg_scroll_depth: { avgKey: 'avg_scroll',   verb: 'scrolled' },
            session_duration: { avgKey: 'avg_duration', verb: 'spent time' },
            pages_visited:    { avgKey: 'avg_pages',    verb: 'visited pages' },
        };

        const insights = [];
        for (const metric of metrics) {
            const { avgKey, verb } = metricLabels[metric];
            const cVal = converted[avgKey];
            const dVal = dropped[avgKey];
            if (dVal > 0 && cVal > dVal * 1.5) {
                const ratio = (cVal / dVal).toFixed(1);
                insights.push(`Converted users ${verb} ${ratio}x more than users who dropped off`);
            } else if (cVal > 0 && dVal === 0) {
                insights.push(`Converted users ${verb} significantly more (dropped-off users had none)`);
            }
        }

        res.json({ converted, dropped, insights });

    } catch (error) {
        console.error('Conversion influence error:', error);
        res.status(500).json({ error: 'Failed to compute conversion influence' });
    }
});

// Engagement Scores
// Multi-tenant: filter engagement-scores by site_id
router.get('/engagement-scores', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        const result = await pool.query(
            `SELECT session_id, avg_scroll_depth, session_duration, total_clicks, max_funnel_stage
             FROM session_features
             WHERE site_id = $1`,
            [site_id]
        );

        const sessions = result.rows;

        if (sessions.length === 0) {
            return res.json({
                distribution: {
                    highly_engaged: { count: 0, percentage: 0 },
                    moderately_engaged: { count: 0, percentage: 0 },
                    passive: { count: 0, percentage: 0 }
                },
                average_score: 0,
                scores_by_funnel_stage: {},
                top_sessions: []
            });
        }

        const maxDuration = Math.max(...sessions.map(s => Number(s.session_duration)));
        const maxClicks = Math.max(...sessions.map(s => Number(s.total_clicks)));

        const scored = sessions.map(s => {
            const avgScroll = Number(s.avg_scroll_depth);
            const duration = Number(s.session_duration);
            const clicks = Number(s.total_clicks);

            const normalizedDuration = maxDuration > 0 ? (duration / maxDuration) * 100 : 0;
            const normalizedClicks = maxClicks > 0 ? (clicks / maxClicks) * 100 : 0;

            const score = Number(
                (avgScroll * 0.40 + normalizedDuration * 0.35 + normalizedClicks * 0.25).toFixed(2)
            );

            let category;
            if (score >= 70) category = 'highly_engaged';
            else if (score >= 40) category = 'moderately_engaged';
            else category = 'passive';

            return {
                session_id: s.session_id,
                score,
                category,
                avg_scroll_depth: avgScroll,
                session_duration: duration,
                total_clicks: clicks,
                max_funnel_stage: s.max_funnel_stage
            };
        });

        // Distribution
        const distribution = {
            highly_engaged: { count: 0, percentage: 0 },
            moderately_engaged: { count: 0, percentage: 0 },
            passive: { count: 0, percentage: 0 }
        };

        scored.forEach(s => {
            distribution[s.category].count++;
        });

        const total = scored.length;
        for (const key of Object.keys(distribution)) {
            distribution[key].percentage = Number(
                ((distribution[key].count / total) * 100).toFixed(2)
            );
        }

        // Average score
        const average_score = Number(
            (scored.reduce((sum, s) => sum + s.score, 0) / total).toFixed(2)
        );

        // Scores by funnel stage
        const stageGroups = {};
        scored.forEach(s => {
            const stage = s.max_funnel_stage;
            if (!stageGroups[stage]) stageGroups[stage] = [];
            stageGroups[stage].push(s.score);
        });

        const scores_by_funnel_stage = {};
        for (const [stage, scores] of Object.entries(stageGroups)) {
            scores_by_funnel_stage[stage] = Number(
                (scores.reduce((sum, sc) => sum + sc, 0) / scores.length).toFixed(2)
            );
        }

        // Top 20 sessions by score
        const top_sessions = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);

        res.json({
            distribution,
            average_score,
            scores_by_funnel_stage,
            top_sessions
        });

    } catch (error) {
        console.error('Engagement scores error:', error);
        res.status(500).json({ error: 'Failed to compute engagement scores' });
    }
});

// ─── Session List ─────────────────────────────────────────────────────────────
// GET /api/analytics/sessions?site_id=X&page=1&limit=20&sort_by=timestamp&sort_dir=desc
router.get('/analytics/sessions', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const ALLOWED_SORT = ['duration', 'timestamp', 'pages_visited', 'max_funnel_stage', 'scroll_depth'];
        const sortBy = ALLOWED_SORT.includes(req.query.sort_by) ? req.query.sort_by : 'timestamp';
        const sortDir = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';

        const colMap = {
            duration:         's.duration',
            timestamp:        's.start_time',
            pages_visited:    'COALESCE(sf.pages_visited, s.total_pages)',
            max_funnel_stage: 'COALESCE(sf.max_funnel_stage, 0)',
            scroll_depth:     'COALESCE(sf.avg_scroll_depth, s.max_scroll_depth)',
        };

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM sessions s WHERE s.site_id = $1`,
            [site_id]
        );
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT
                s.session_id,
                s.duration,
                s.total_clicks,
                s.max_scroll_depth,
                s.total_pages,
                s.start_time,
                COALESCE(sf.pages_visited, s.total_pages)       AS pages_visited,
                COALESCE(sf.max_funnel_stage, 0)                AS max_funnel_stage,
                COALESCE(sf.avg_scroll_depth, s.max_scroll_depth) AS avg_scroll_depth
            FROM sessions s
            LEFT JOIN session_features sf
                ON s.session_id = sf.session_id AND sf.site_id = $1
            WHERE s.site_id = $1
            ORDER BY ${colMap[sortBy]} ${sortDir} NULLS LAST
            LIMIT $2 OFFSET $3
        `, [site_id, limit, offset]);

        res.json({ sessions: result.rows, total, page, limit });
    } catch (error) {
        console.error('Session list error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// ─── Session Detail ────────────────────────────────────────────────────────────
// GET /api/analytics/sessions/:session_id?site_id=X
router.get('/analytics/sessions/:session_id', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const { session_id } = req.params;
        const site_id = req.siteId;

        const sessionResult = await pool.query(`
            SELECT
                s.session_id, s.start_time, s.end_time, s.duration,
                s.total_clicks, s.max_scroll_depth, s.total_pages, s.site_id,
                COALESCE(sf.pages_visited, s.total_pages)       AS pages_visited,
                COALESCE(sf.max_funnel_stage, 0)                AS max_funnel_stage,
                COALESCE(sf.avg_scroll_depth, s.max_scroll_depth) AS avg_scroll_depth
            FROM sessions s
            LEFT JOIN session_features sf
                ON s.session_id = sf.session_id AND sf.site_id = $2
            WHERE s.session_id = $1 AND s.site_id = $2
        `, [session_id, site_id]);

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const eventsResult = await pool.query(`
            SELECT event_type, page_url, x, y, scroll_depth, timestamp
            FROM events
            WHERE session_id = $1 AND site_id = $2
            ORDER BY timestamp ASC
            LIMIT 300
        `, [session_id, site_id]);

        res.json({ session: sessionResult.rows[0], events: eventsResult.rows });
    } catch (error) {
        console.error('Session detail error:', error);
        res.status(500).json({ error: 'Failed to fetch session detail' });
    }
});

// ─── Risk Distribution ─────────────────────────────────────────────────────────
// GET /api/analytics/risk-distribution?site_id=X
router.get('/analytics/risk-distribution', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        const result = await pool.query(`
            SELECT session_id, avg_scroll_depth, session_duration,
                   total_clicks, pages_visited, max_funnel_stage
            FROM session_features
            WHERE site_id = $1
        `, [site_id]);

        if (result.rows.length === 0) {
            return res.json({
                distribution: { high: 0, medium: 0, low: 0 },
                sessions: [],
                total: 0,
            });
        }

        const sessions = result.rows;
        const maxDuration = Math.max(...sessions.map(s => Number(s.session_duration)), 1);
        const maxClicks   = Math.max(...sessions.map(s => Number(s.total_clicks)), 1);
        const maxPages    = Math.max(...sessions.map(s => Number(s.pages_visited)), 1);

        const scored = sessions.map(s => {
            const normDur    = Number(s.session_duration) / maxDuration;
            const normClicks = Number(s.total_clicks)     / maxClicks;
            const normPages  = Number(s.pages_visited)    / maxPages;
            const normStage  = Number(s.max_funnel_stage) / 3;
            const normScroll = Number(s.avg_scroll_depth) / 100;

            const engagement =
                normDur * 0.28 + normPages * 0.2 + normStage * 0.24 +
                normScroll * 0.18 + normClicks * 0.1;

            const riskScore = Math.max(0.02, Math.min(0.98, 1 - engagement));

            let risk_tier;
            if (riskScore >= 0.67) risk_tier = 'high';
            else if (riskScore >= 0.40) risk_tier = 'medium';
            else risk_tier = 'low';

            return {
                session_id: s.session_id,
                risk_score: Number(riskScore.toFixed(3)),
                risk_tier,
            };
        });

        const distribution = { high: 0, medium: 0, low: 0 };
        scored.forEach(s => distribution[s.risk_tier]++);

        const topSessions = scored
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 100);

        res.json({ distribution, sessions: topSessions, total: sessions.length });
    } catch (error) {
        console.error('Risk distribution error:', error);
        res.status(500).json({ error: 'Failed to compute risk distribution' });
    }
});

// ─── Sentiment Insights ────────────────────────────────────────────────────────
// GET /api/analytics/sentiment-insights?site_id=X
router.get('/analytics/sentiment-insights', authMiddleware, requireAuthorizedSiteId, async (req, res) => {
    try {
        const site_id = req.siteId;

        const countResult = await pool.query(`
            SELECT sentiment_label, COUNT(*)::int AS count
            FROM feedback
            WHERE site_id = $1 AND sentiment_label IS NOT NULL
            GROUP BY sentiment_label
        `, [site_id]);

        if (countResult.rows.length === 0) {
            return res.json({
                counts: { positive: 0, neutral: 0, negative: 0 },
                percentages: { positive: 0, neutral: 0, negative: 0 },
                total: 0,
                snippets: { positive: [], neutral: [], negative: [] },
            });
        }

        const counts = { positive: 0, neutral: 0, negative: 0 };
        let total = 0;
        for (const row of countResult.rows) {
            if (Object.prototype.hasOwnProperty.call(counts, row.sentiment_label)) {
                counts[row.sentiment_label] = row.count;
                total += row.count;
            }
        }

        const percentages = {};
        for (const [label, count] of Object.entries(counts)) {
            percentages[label] = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
        }

        // Fetch representative snippets per category
        const snippets = { positive: [], neutral: [], negative: [] };

        for (const label of ['positive', 'neutral']) {
            const { rows } = await pool.query(`
                SELECT message FROM feedback
                WHERE site_id = $1 AND sentiment_label = $2
                ORDER BY sentiment_score DESC
                LIMIT 3
            `, [site_id, label]);
            snippets[label] = rows.map(r => r.message);
        }

        // Negative: lowest sentiment scores are the most negative
        const { rows: negRows } = await pool.query(`
            SELECT message FROM feedback
            WHERE site_id = $1 AND sentiment_label = 'negative'
            ORDER BY sentiment_score ASC
            LIMIT 3
        `, [site_id]);
        snippets.negative = negRows.map(r => r.message);

        res.json({ counts, percentages, total, snippets });
    } catch (error) {
        console.error('Sentiment insights error:', error);
        res.status(500).json({ error: 'Failed to fetch sentiment insights' });
    }
});

module.exports = router;