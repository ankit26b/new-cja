const pool = require('./config/db');
require('dotenv').config();

async function createTenantAccessTables() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sites (
        user_id INTEGER NOT NULL,
        site_id VARCHAR(64) NOT NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, site_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE CASCADE
      )
    `);

    // Ensure default admin has access to all known sites
    await client.query(`
      INSERT INTO user_sites (user_id, site_id)
      SELECT u.id, s.site_id
      FROM users u
      CROSS JOIN sites s
      WHERE u.role = 'admin'
      ON CONFLICT (user_id, site_id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅ tenant access tables ready (user_sites)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ tenant access migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

createTenantAccessTables();
