const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true, // Allow multiple statements for init.sql
  dateStrings: true // Ensure dates are returned as strings without timezone offset issues
};

const databaseName = process.env.DB_NAME || 'forge_db';
const pool = mysql.createPool({ ...dbConfig, database: databaseName });

(async () => {
  try {
    // 1. Create connection without database selected to ensure database exists
    const initConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await initConnection.end();

    // 2. Now connect to the pool with the database selected
    const connection = await pool.getConnection();
    console.log('Database connected successfully');

    // 3. Run init.sql to ensure tables exist
    const initSqlPath = path.join(__dirname, '../../sql/init.sql');
    if (fs.existsSync(initSqlPath)) {
      const sqlContent = fs.readFileSync(initSqlPath, 'utf8');
      await connection.query(sqlContent);
      console.log('Database tables verified/initialized.');
    }

    connection.release();
  } catch (error) {
    console.error('Database connection or initialization failed:', error.message);
  }
})();

module.exports = pool;
