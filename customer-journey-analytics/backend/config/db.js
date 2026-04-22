const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'cja',
    password: '2005',
    port: 5432,
});

module.exports = pool;