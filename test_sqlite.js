const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function test() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  try {
    const row = await db.get('INSERT INTO test (name) VALUES (?) RETURNING *', ['Alice']);
    console.log('RETURNING supported! Row:', row);
  } catch (e) {
    console.log('RETURNING NOT supported:', e.message);
  }
}
test();
