const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const runMigration = async () => {
    try {
        const pool = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
        });

        console.log('Connected to database.');

        const sqlPath = path.join(__dirname, 'migrations', 'add_reset_password_cols.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration...');
        await pool.query(sql);  // Changed from execute to query
        console.log('Migration executed successfully.');

        await pool.end();
    } catch (error) {
        console.error('Migration failed:', error);
    }
};

runMigration();
