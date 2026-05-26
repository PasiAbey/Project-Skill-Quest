const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Azure specific tuning to prevent ECONNRESET
  idleTimeout: 60000, // Close idle connections after 60s (well below Azure's 4min default)
  maxIdle: 0 // Do not keep idle connections open
});

// Wrapper to handle connection errors automatically
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

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to Azure MySQL Database');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
};

testConnection();

module.exports = pool;
