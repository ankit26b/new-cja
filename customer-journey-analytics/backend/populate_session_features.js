const pool = require('./config/db');

const FUNNEL = ['/product', '/cart', '/checkout', '/payment'];

async function populate() {
  try {
    // Get all sessions
    const sessions = await pool.query(
      `SELECT session_id, duration, total_clicks, max_scroll_depth, total_pages
       FROM sessions`
    );

    if (sessions.rows.length === 0) {
      console.log('No sessions found — nothing to populate.');
      return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const s of sessions.rows) {
      // Compute avg_scroll_depth from events
      const scrollResult = await pool.query(
        `SELECT AVG(scroll_depth) AS avg_scroll
         FROM events
         WHERE session_id = $1 AND event_type = 'scroll' AND scroll_depth IS NOT NULL`,
        [s.session_id]
      );
      const avgScroll = parseFloat(scrollResult.rows[0]?.avg_scroll) || parseFloat(s.max_scroll_depth) || 0;

      // Compute max funnel stage from page_view events
      const pageResult = await pool.query(
        `SELECT DISTINCT page_url FROM events
         WHERE session_id = $1 AND event_type = 'page_view'`,
        [s.session_id]
      );
      const pages = pageResult.rows.map(r => r.page_url);
      let maxFunnel = 0;
      pages.forEach(p => {
        const idx = FUNNEL.indexOf(p);
        if (idx > maxFunnel) maxFunnel = idx;
      });

      const duration = parseFloat(s.duration) || 0;
      const clicks = parseInt(s.total_clicks) || 0;
      const pagesVisited = parseInt(s.total_pages) || 0;

      try {
        await pool.query(
          `INSERT INTO session_features (session_id, total_clicks, avg_scroll_depth, session_duration, pages_visited, max_funnel_stage)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (session_id) DO UPDATE SET
             total_clicks = EXCLUDED.total_clicks,
             avg_scroll_depth = EXCLUDED.avg_scroll_depth,
             session_duration = EXCLUDED.session_duration,
             pages_visited = EXCLUDED.pages_visited,
             max_funnel_stage = EXCLUDED.max_funnel_stage`,
          [s.session_id, clicks, avgScroll, duration, pagesVisited, maxFunnel]
        );
        inserted++;
      } catch (e) {
        skipped++;
      }
    }

    console.log(`✅ Populated session_features: ${inserted} rows inserted/updated, ${skipped} skipped.`);
  } catch (err) {
    console.error('Error populating session_features:', err);
  } finally {
    pool.end();
  }
}

populate();
