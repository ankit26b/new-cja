const pool = require('./config/db');

pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'session_features' ORDER BY ordinal_position")
  .then(r => {
    console.log(JSON.stringify(r.rows, null, 2));
    pool.end();
  })
  .catch(e => {
    console.error(e.message);
    pool.end();
  });
