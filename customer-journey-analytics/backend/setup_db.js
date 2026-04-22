const pool = require('./config/db');

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

    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        duration DECIMAL,
        total_clicks INTEGER DEFAULT 0,
        max_scroll_depth INTEGER DEFAULT 0,
        total_pages INTEGER DEFAULT 0
      )
    `);

    console.log('✅ sessions table created');

    // Create events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        x INTEGER,
        y INTEGER,
        page_url VARCHAR(255),
        scroll_depth INTEGER,
        timestamp TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )
    `);

    console.log('✅ events table created');
    console.log('Database setup complete!');

  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    pool.end();
  }
}

createTables();
