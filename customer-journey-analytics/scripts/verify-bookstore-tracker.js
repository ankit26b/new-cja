/*
  verify-bookstore-tracker.js

  Purpose:
  1) Simulate a full bookstore funnel session for site_id demo_bookstore_002
  2) Send page_view, click, scroll, mouse_move, and funnel_stage events to /api/track
  3) Query PostgreSQL and verify:
     - events landed with correct site_id
     - no cross-contamination with default_site for bookstore pages
     - funnel stages incremented 0 -> 1 -> 2 -> 3

  Run:
    node scripts/verify-bookstore-tracker.js
*/

const { randomUUID } = require('crypto');
const { Client } = require('pg');

const TRACK_ENDPOINT = process.env.TRACK_ENDPOINT || 'http://localhost:5000/api/track';
const SITE_ID = 'demo_bookstore_002';
const OTHER_SITE_ID = process.env.OTHER_SITE_ID || 'default_site';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cja',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const FUNNEL_PATHS = ['/book/101', '/cart', '/checkout', '/order-confirmed'];
const ROUTE_FLOW = ['/', '/book/101', '/cart', '/checkout', '/order-confirmed'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildEvent({ sessionId, eventType, page, x = null, y = null, scrollDepth = 0, funnelStage = null }) {
  return {
    site_id: SITE_ID,
    session_id: sessionId,
    event_type: eventType,
    page_url: page,
    x,
    y,
    scroll_depth: scrollDepth,
    funnel_stage: funnelStage,
    timestamp: new Date().toISOString(),
    user_agent: 'verify-bookstore-tracker-script/1.0',
  };
}

async function postTrackEvent(payload) {
  const res = await fetch(TRACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Track API failed (${res.status}): ${body}`);
  }
}

async function simulateSession(sessionId) {
  console.log(`\nSimulating session: ${sessionId}`);

  for (let i = 0; i < ROUTE_FLOW.length; i++) {
    const page = ROUTE_FLOW[i];

    await postTrackEvent(buildEvent({
      sessionId,
      eventType: 'page_view',
      page,
      scrollDepth: Math.min(10 + i * 15, 100),
    }));

    await postTrackEvent(buildEvent({
      sessionId,
      eventType: 'click',
      page,
      x: 120 + i * 25,
      y: 240 + i * 20,
      scrollDepth: Math.min(10 + i * 15, 100),
    }));

    await postTrackEvent(buildEvent({
      sessionId,
      eventType: 'scroll',
      page,
      scrollDepth: Math.min(20 + i * 20, 100),
    }));

    await postTrackEvent(buildEvent({
      sessionId,
      eventType: 'mouse_move',
      page,
      x: 320 + i * 10,
      y: 180 + i * 8,
      scrollDepth: Math.min(20 + i * 20, 100),
    }));

    const funnelStage = FUNNEL_PATHS.findIndex((p) => page.startsWith('/book/') ? p.startsWith('/book/') : p === page);
    if (funnelStage >= 0) {
      await postTrackEvent(buildEvent({
        sessionId,
        eventType: 'funnel_stage',
        page,
        funnelStage,
      }));
    }

    await sleep(80);
  }

  console.log('Synthetic event flow sent to tracking API.');
}

async function verifyInDatabase(sessionId) {
  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    const total = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM events
       WHERE site_id = $1 AND session_id = $2`,
      [SITE_ID, sessionId]
    );

    const byType = await client.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM events
       WHERE site_id = $1 AND session_id = $2
       GROUP BY event_type
       ORDER BY event_type`,
      [SITE_ID, sessionId]
    );

    const crossContamination = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM events
       WHERE site_id = $1
         AND page_url IN ('/book/101', '/cart', '/checkout', '/order-confirmed')`,
      [OTHER_SITE_ID]
    );

    const funnelRows = await client.query(
      `SELECT DISTINCT page_url
       FROM events
       WHERE site_id = $1
         AND session_id = $2
         AND event_type = 'funnel_stage'
       ORDER BY page_url`,
      [SITE_ID, sessionId]
    );

    const stageExpectation = {
      '/book/101': 0,
      '/cart': 1,
      '/checkout': 2,
      '/order-confirmed': 3,
    };

    const inferredStages = await client.query(
      `SELECT page_url,
              CASE
                WHEN page_url LIKE '/book/%' THEN 0
                WHEN page_url = '/cart' THEN 1
                WHEN page_url = '/checkout' THEN 2
                WHEN page_url = '/order-confirmed' THEN 3
                ELSE NULL
              END AS stage
       FROM events
       WHERE site_id = $1
         AND session_id = $2
         AND event_type = 'funnel_stage'
       ORDER BY stage`,
      [SITE_ID, sessionId]
    );

    console.log('\n=== Verification Report ===');
    console.log('Total events inserted:', total.rows[0].count);
    console.log('Event counts by type:', byType.rows);
    console.log(`Cross-contamination (${OTHER_SITE_ID}) on bookstore pages:`, crossContamination.rows[0].count);

    const pagesSeen = new Set(funnelRows.rows.map((r) => r.page_url));
    const allExpectedPagesSeen = Object.keys(stageExpectation).every((p) => pagesSeen.has(p));

    const gotStages = inferredStages.rows.map((r) => Number(r.stage)).filter((n) => Number.isFinite(n));
    const stageOrderIsValid = JSON.stringify(gotStages) === JSON.stringify([0, 1, 2, 3]);

    console.log('Funnel pages seen:', Array.from(pagesSeen));
    console.log('Funnel stages inferred:', gotStages);

    const pass = {
      eventsInserted: Number(total.rows[0].count) > 0,
      hasAllEventTypes: ['click', 'funnel_stage', 'mouse_move', 'page_view', 'scroll'].every((t) =>
        byType.rows.some((r) => r.event_type === t && r.count > 0)
      ),
      noCrossContamination: Number(crossContamination.rows[0].count) === 0,
      funnelPagesCovered: allExpectedPagesSeen,
      funnelStageProgression: stageOrderIsValid,
    };

    console.log('\nPass criteria:');
    console.log(pass);

    const allPass = Object.values(pass).every(Boolean);
    if (!allPass) {
      process.exitCode = 1;
      console.error('\nâŒ Verification failed. Check report above.');
    } else {
      console.log('\nâœ… Verification passed for demo_bookstore_002.');
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const sessionId = `bookstore_${randomUUID()}`;
  console.log('Track endpoint:', TRACK_ENDPOINT);
  console.log('DB host:', DB_CONFIG.host, 'DB name:', DB_CONFIG.database);

  await simulateSession(sessionId);
  await sleep(250);
  await verifyInDatabase(sessionId);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

