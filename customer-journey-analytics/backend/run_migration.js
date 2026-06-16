/**
 * run_migration.js — Apply the site_id migration and verify results
 *
 * Usage:  node run_migration.js
 *
 * This script:
 *  1. Adds site_id column to sessions, events, session_features (if missing)
 *  2. Backfills existing rows with 'default_site'
 *  3. Creates performance indexes
 *  4. Prints the updated table schemas so you can verify
 */
const pool = require('./config/db');
require('dotenv').config();

const TABLES = ['sessions', 'events', 'session_features'];

async function run() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Step 1: Add site_id column to each table (idempotent) ──
    for (const table of TABLES) {
      const colCheck = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = 'site_id'`,
        [table]
      );

      if (colCheck.rows.length === 0) {
        await client.query(
          `ALTER TABLE ${table}
           ADD COLUMN site_id VARCHAR(64) NOT NULL DEFAULT 'default_site'`
        );
        console.log(`✅  Added site_id to "${table}"`);

        // Backfill (explicit, even though DEFAULT covers new rows)
        const updated = await client.query(
          `UPDATE ${table} SET site_id = 'default_site' WHERE site_id IS NULL`
        );
        console.log(`    ↳ Backfilled ${updated.rowCount} rows`);
      } else {
        console.log(`ℹ️   "${table}".site_id already exists — skipping`);
      }
    }

    // ── Step 2: Create indexes (idempotent) ──
    const indexes = [
      { name: 'idx_sessions_site_id',           sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_site_id ON sessions (site_id)' },
      { name: 'idx_events_site_id',             sql: 'CREATE INDEX IF NOT EXISTS idx_events_site_id ON events (site_id)' },
      { name: 'idx_session_features_site_id',   sql: 'CREATE INDEX IF NOT EXISTS idx_session_features_site_id ON session_features (site_id)' },
      { name: 'idx_events_site_id_event_type',  sql: 'CREATE INDEX IF NOT EXISTS idx_events_site_id_event_type ON events (site_id, event_type)' },
      { name: 'idx_events_site_id_session_id',  sql: 'CREATE INDEX IF NOT EXISTS idx_events_site_id_session_id ON events (site_id, session_id)' },
      { name: 'idx_sessions_site_id_session_id',sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_site_id_session_id ON sessions (site_id, session_id)' },
    ];

    for (const idx of indexes) {
      await client.query(idx.sql);
      console.log(`✅  Index "${idx.name}" ensured`);
    }

    await client.query('COMMIT');
    console.log('\n── Migration committed ──\n');

    // ── Step 3: Show updated schemas ──
    console.log('========================================');
    console.log('  UPDATED TABLE SCHEMAS (post-migration)');
    console.log('========================================\n');

    for (const table of TABLES) {
      const schema = await client.query(
        `SELECT column_name, data_type, character_maximum_length,
                column_default, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      console.log(`📋 ${table}`);
      console.log('─'.repeat(90));
      console.log(
        'Column'.padEnd(25) +
        'Type'.padEnd(20) +
        'Nullable'.padEnd(12) +
        'Default'
      );
      console.log('─'.repeat(90));

      for (const col of schema.rows) {
        const type = col.character_maximum_length
          ? `${col.data_type}(${col.character_maximum_length})`
          : col.data_type;
        console.log(
          col.column_name.padEnd(25) +
          type.padEnd(20) +
          col.is_nullable.padEnd(12) +
          (col.column_default || '')
        );
      }
      console.log();
    }

    // ── Step 4: Show row counts per site_id ──
    console.log('========================================');
    console.log('  ROW COUNTS PER site_id');
    console.log('========================================\n');

    for (const table of TABLES) {
      const counts = await client.query(
        `SELECT site_id, COUNT(*)::int AS row_count
         FROM ${table}
         GROUP BY site_id
         ORDER BY row_count DESC`
      );
      console.log(`📋 ${table}`);
      if (counts.rows.length === 0) {
        console.log('   (empty table)');
      } else {
        for (const r of counts.rows) {
          console.log(`   site_id="${r.site_id}"  →  ${r.row_count} rows`);
        }
      }
      console.log();
    }

    // ── Step 5: Show indexes ──
    console.log('========================================');
    console.log('  INDEXES ON site_id');
    console.log('========================================\n');

    const idxResult = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE indexname LIKE '%site_id%'
      ORDER BY tablename, indexname
    `);

    for (const idx of idxResult.rows) {
      console.log(`  ${idx.indexname}`);
      console.log(`    → ${idx.indexdef}`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
