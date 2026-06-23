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

  const queries = [
    'SELECT current_database(), current_user, inet_server_addr(), inet_server_port();',
    'SELECT COUNT(*) AS sessions_count FROM sessions;',
    'SELECT COUNT(*) AS events_count FROM events;',
    'SELECT COUNT(*) AS session_features_count FROM session_features;',
    'SELECT site_id, COUNT(*)::int AS events FROM events GROUP BY site_id ORDER BY events DESC;',
  ];

  for (const sql of queries) {
    console.log(`SQL> ${sql}`);
    const result = await client.query(sql);
    console.table(result.rows);
  }

  await client.end();
}

run().catch((error) => {
  console.error('VERIFY_ERROR:', error);
  process.exit(1);
});
