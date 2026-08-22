const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db;

async function initDB() {
  try {
    db = await open({
      filename: path.join(__dirname, 'expense_tracker.sqlite'),
      driver: sqlite3.Database
    });

    console.log('Connected to SQLite database.');

    // Enable foreign keys
    await db.run('PRAGMA foreign_keys = ON');

    // Run schema setup if tables don't exist
    const tableCheck = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='Users';
    `);
    
    if (!tableCheck) {
      console.log('Tables do not exist. Initializing database schema...');
      const schemaPath = path.join(__dirname, 'db_schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // sqlite module exec can run multiple statements separated by ;
      await db.exec(schemaSql);
      console.log('Database schema initialized and seeded successfully.');
    } else {
      console.log('Database tables already exist. Skipping schema initialization.');
    }
  } catch (err) {
    console.error('Error initializing database:', err.message);
  }
}

async function query(text, params = []) {
  if (!db) {
    throw new Error('Database not initialized. Call initDB first.');
  }

  // SQLite arrays for parameters don't like undefined
  const safeParams = params.map(p => p === undefined ? null : p);

  // Convert Postgres $1, $2, etc. to SQLite ?1, ?2, etc.
  text = text.replace(/\$(\d+)/g, '?$1');

  // If the query is an INSERT, UPDATE, or DELETE
  const isWrite = /^\s*(INSERT|UPDATE|DELETE)/i.test(text);
  if (isWrite) {
    // For INSERT ... RETURNING, we must use all() to get the rows, and not run()
    if (/\bRETURNING\b/i.test(text)) {
      const rows = await db.all(text, safeParams);
      return { rows, rowCount: rows.length };
    }
    const result = await db.run(text, safeParams);
    return { rowCount: result.changes, lastID: result.lastID };
  } else {
    const rows = await db.all(text, safeParams);
    return { rowCount: rows.length, rows };
  }
}

module.exports = {
  initDB,
  query,
  getDb: () => db
};
