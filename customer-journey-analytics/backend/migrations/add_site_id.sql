-- ============================================================
-- Migration: Add multi-tenant site_id column to all relevant tables
-- Author:    auto-generated
-- Date:      2026-06-16
-- Idempotent: YES — safe to run multiple times
-- ============================================================

BEGIN;

-- -------------------------------------------------------
-- 1. sessions — add site_id column if it doesn't exist
-- -------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'site_id'
    ) THEN
        ALTER TABLE sessions
            ADD COLUMN site_id VARCHAR(64) NOT NULL DEFAULT 'default_site';

        -- Backfill existing rows (redundant with DEFAULT, but explicit for clarity)
        UPDATE sessions SET site_id = 'default_site' WHERE site_id IS NULL;

        RAISE NOTICE 'Added site_id to sessions';
    ELSE
        RAISE NOTICE 'sessions.site_id already exists — skipping';
    END IF;
END $$;

-- -------------------------------------------------------
-- 2. events — add site_id column if it doesn't exist
-- -------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'site_id'
    ) THEN
        ALTER TABLE events
            ADD COLUMN site_id VARCHAR(64) NOT NULL DEFAULT 'default_site';

        UPDATE events SET site_id = 'default_site' WHERE site_id IS NULL;

        RAISE NOTICE 'Added site_id to events';
    ELSE
        RAISE NOTICE 'events.site_id already exists — skipping';
    END IF;
END $$;

-- -------------------------------------------------------
-- 3. session_features — add site_id column if it doesn't exist
-- -------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'session_features' AND column_name = 'site_id'
    ) THEN
        ALTER TABLE session_features
            ADD COLUMN site_id VARCHAR(64) NOT NULL DEFAULT 'default_site';

        UPDATE session_features SET site_id = 'default_site' WHERE site_id IS NULL;

        RAISE NOTICE 'Added site_id to session_features';
    ELSE
        RAISE NOTICE 'session_features.site_id already exists — skipping';
    END IF;
END $$;

-- -------------------------------------------------------
-- 4. Create indexes for query performance
--    IF NOT EXISTS makes these idempotent
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_site_id
    ON sessions (site_id);

CREATE INDEX IF NOT EXISTS idx_events_site_id
    ON events (site_id);

CREATE INDEX IF NOT EXISTS idx_session_features_site_id
    ON session_features (site_id);

-- Composite indexes for common query patterns (site_id + other filter columns)
CREATE INDEX IF NOT EXISTS idx_events_site_id_event_type
    ON events (site_id, event_type);

CREATE INDEX IF NOT EXISTS idx_events_site_id_session_id
    ON events (site_id, session_id);

CREATE INDEX IF NOT EXISTS idx_sessions_site_id_session_id
    ON sessions (site_id, session_id);

COMMIT;

-- ============================================================
-- Post-migration: verify columns exist
-- ============================================================
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('sessions', 'events', 'session_features')
  AND column_name = 'site_id'
ORDER BY table_name;
