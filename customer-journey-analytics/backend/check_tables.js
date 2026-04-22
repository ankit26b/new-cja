const pool = require('./config/db');

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
  .then(r => console.log('Tables:', r.rows))
  .catch(e => console.error('Error:', e))
  .finally(() => pool.end());
