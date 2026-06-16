const pool = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTables() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ users table created');

    // Create sessions table — includes site_id for multi-tenant support
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        site_id VARCHAR(64) NOT NULL DEFAULT 'default_site',
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        duration DECIMAL,
        total_clicks INTEGER DEFAULT 0,
        max_scroll_depth INTEGER DEFAULT 0,
        total_pages INTEGER DEFAULT 0
      )
    `);

    console.log('✅ sessions table created');

    // Create events table — includes site_id for multi-tenant support
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        x INTEGER,
        y INTEGER,
        page_url VARCHAR(255),
        scroll_depth INTEGER,
        site_id VARCHAR(64) NOT NULL DEFAULT 'default_site',
        timestamp TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )
    `);

    console.log('✅ events table created');

    // Create session_features table — includes site_id for multi-tenant support
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_features (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        site_id VARCHAR(64) NOT NULL DEFAULT 'default_site',
        total_clicks INTEGER DEFAULT 0,
        avg_scroll_depth DECIMAL DEFAULT 0,
        session_duration DECIMAL DEFAULT 0,
        pages_visited INTEGER DEFAULT 0,
        max_funnel_stage INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )
    `);

    console.log('✅ session_features table created');
    console.log('Database setup complete!');

    // Optional admin seed from environment variables
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME } = process.env;
    if (ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_USERNAME) {
      const adminCountResult = await pool.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'"
      );
      if (adminCountResult.rows[0].count === 0) {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await pool.query(
          'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
          [ADMIN_EMAIL, hashedPassword, 'admin']
        );
        console.log(`✅ Admin user seeded: ${ADMIN_EMAIL}`);
      } else {
        console.log('ℹ️  Admin already exists — skipping seed.');
      }
    }

  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    pool.end();
  }
}

createTables();
