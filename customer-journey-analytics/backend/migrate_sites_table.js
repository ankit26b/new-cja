const pool = require('./config/db');
require('dotenv').config();

async function migrateSitesTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        site_id VARCHAR(64) PRIMARY KEY,
        display_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      INSERT INTO sites (site_id, display_name)
      VALUES
        ('ecommerce_001', 'Demo E-Commerce Store'),
        ('demo_bookstore_002', 'Demo Bookstore')
      ON CONFLICT (site_id) DO UPDATE
      SET display_name = EXCLUDED.display_name
    `);

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

    await client.query(`
      INSERT INTO user_sites (user_id, site_id)
      SELECT u.id, s.site_id
      FROM users u
      CROSS JOIN sites s
      WHERE u.role = 'admin'
      ON CONFLICT (user_id, site_id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅ sites table migration completed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ sites table migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateSitesTable();
