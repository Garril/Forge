const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
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

const ready = (async () => {
  // Create the database before opening any pool connection that selects it.
  const initConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });

  try {
    await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await initConnection.end();
  }

  const connection = await pool.getConnection();
  try {
    console.log('Database connected successfully');
    const initSqlPath = path.join(__dirname, '../../sql/init.sql');
    if (fs.existsSync(initSqlPath)) {
      const sqlContent = fs.readFileSync(initSqlPath, 'utf8');
      await connection.query(sqlContent);
      console.log('Database tables verified/initialized.');
    }
  } finally {
    connection.release();
  }
})();

pool.ready = ready;

module.exports = pool;
