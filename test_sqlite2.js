const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function test() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  await db.run('INSERT INTO test (name) VALUES ($1)', ['Alice']);
  const row = await db.get('SELECT * FROM test WHERE name = $1', ['Alice']);
  console.log('Row:', row);
}
test();
