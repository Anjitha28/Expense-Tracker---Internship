const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;
const dbName = process.env.DB_DATABASE || 'expense_tracker';

let pool;

async function initDB() {
  // Step 1: Connect to default 'postgres' database to ensure our database exists
  const tempPool = new Pool({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: 'postgres'
  });

  try {
    const res = await tempPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await tempPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (err) {
    console.error('Error checking/creating database:', err.message);
    console.log('Please make sure PostgreSQL is running and credentials in .env are correct.');
  } finally {
    await tempPool.end();
  }

  // Step 2: Connect to the target database
  pool = new Pool({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: dbName
  });

  // Step 3: Run schema setup if tables don't exist
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Users'
      );
    `);
    
    const exists = tableCheck.rows[0].exists;
    if (!exists) {
      console.log('Tables do not exist. Initializing database schema...');
      const schemaPath = path.join(__dirname, 'db_schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Database schema initialized and seeded successfully.');
    } else {
      console.log('Database tables already exist. Skipping schema initialization.');
    }
  } catch (err) {
    console.error('Error initializing tables:', err.message);
  }
}

module.exports = {
  initDB,
  query: (text, params) => {
    if (!pool) {
      throw new Error('Database pool not initialized. Call initDB first.');
    }
    return pool.query(text, params);
  },
  getPool: () => pool
};
