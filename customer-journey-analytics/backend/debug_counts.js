const pool = require('./config/db');
require('dotenv').config();

async function run() {
  try {
    const conn = await pool.query(
      'SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS host, inet_server_port() AS port'
    );
    console.log('DB_CONN:', conn.rows[0]);

    const counts = await pool.query(`
      SELECT 'sessions' AS table_name, COUNT(*)::int AS rows FROM sessions
      UNION ALL
      SELECT 'events' AS table_name, COUNT(*)::int AS rows FROM events
      UNION ALL
      SELECT 'session_features' AS table_name, COUNT(*)::int AS rows FROM session_features
      UNION ALL
      SELECT 'sites' AS table_name, COUNT(*)::int AS rows FROM sites
      UNION ALL
      SELECT 'user_sites' AS table_name, COUNT(*)::int AS rows FROM user_sites
    `);

    console.table(counts.rows);

    const bySite = await pool.query(
      'SELECT site_id, COUNT(*)::int AS events FROM events GROUP BY site_id ORDER BY events DESC'
    );

    console.log('EVENTS_BY_SITE:', bySite.rows);
  } catch (error) {
    console.error('COUNT_DEBUG_ERROR:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
