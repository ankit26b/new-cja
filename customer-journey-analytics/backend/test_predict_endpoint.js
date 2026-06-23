require('dotenv').config({ path: './.env' });
const { Client } = require('pg');

async function run() {
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
  });

  await client.connect();

  const sessionResult = await client.query(`
    SELECT session_id, site_id
    FROM sessions
    WHERE site_id IS NOT NULL
    ORDER BY start_time DESC
    LIMIT 1
  `);

  await client.end();

  if (sessionResult.rows.length === 0) {
    console.log('NO_SESSION');
    return;
  }

  const { session_id, site_id } = sessionResult.rows[0];
  console.log('USING_SESSION', { session_id, site_id });

  try {
    const response = await fetch(
      `http://localhost:5000/api/predict/${encodeURIComponent(session_id)}?site_id=${encodeURIComponent(site_id)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_BEARER_TOKEN || ''}`,
        },
      }
    );

    const text = await response.text();
    console.log('STATUS', response.status);
    console.log('BODY', text);
  } catch (error) {
    console.error('REQUEST_ERROR', error.message);
  }
}

run().catch((error) => {
  console.error('TEST_ERROR', error);
  process.exit(1);
});
