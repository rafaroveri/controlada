const { Pool } = require('pg');
const { DATABASE_URL, DATABASE_SSL } = require('../env');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false
});

pool.on('error', (error) => {
  console.error('Erro inesperado no pool do PostgreSQL:', error);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
