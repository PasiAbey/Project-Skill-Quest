const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql', // Container hostname in docker-compose
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'skillquest',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  idleTimeout: 60000,
  maxIdle: 0
});

// Wrapper to execute queries with automatic reconnect capability
const query = async (sql, params) => {
  try {
    return await pool.execute(sql, params);
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.warn('⚠️ Database connection lost, retrying query...');
      return await pool.execute(sql, params);
    }
    throw error;
  }
};

module.exports = {
  pool,
  query
};
