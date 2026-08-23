const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use POSTGRES_URL from Vercel Postgres, or fallback to local DB credentials
const connectionString = process.env.POSTGRES_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const pool = new Pool({
  connectionString: connectionString,
  // Add SSL requirement if running on Vercel
  ssl: process.env.POSTGRES_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database.');

    // Check if the Users table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Users'
      );
    `);
    
    if (!result.rows[0].exists) {
      console.log('Tables do not exist. Initializing database schema...');
      const schemaPath = path.join(__dirname, 'db_schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      await client.query(schemaSql);
      console.log('Database schema initialized successfully.');
    } else {
      console.log('Database tables already exist. Skipping schema initialization.');
    }

    client.release();
  } catch (err) {
    console.error('Error initializing PostgreSQL database:', err.message);
  }
}

// Wrapper for queries to match original SQLite-compatible API used in server.js
async function query(text, params = []) {
  const result = await pool.query(text, params);
  
  // Return consistent format used by server.js
  return {
    rows: result.rows,
    rowCount: result.rowCount
  };
}

module.exports = {
  initDB,
  query,
  getPool: () => pool
};
