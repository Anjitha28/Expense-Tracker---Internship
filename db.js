const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use POSTGRES_URL / DATABASE_URL from Vercel Postgres / Neon / Supabase, or fallback to local DB credentials
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const isRemoteDB = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL || (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')));

const pool = new Pool({
  connectionString: connectionString,
  ssl: isRemoteDB ? { rejectUnauthorized: false } : false
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
