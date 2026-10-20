const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureTaxedColumn } = require('../src/db');

const OLD_ITEMS_SQL = `CREATE TABLE items (
    id TEXT PRIMARY KEY, spec TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL DEFAULT 0,
    company TEXT NOT NULL DEFAULT '', remark TEXT NOT NULL DEFAULT '', date TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`;

function tableColumns(db) {
  return db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
}

test('存量库无 taxed 列时自动补列并给旧数据默认值 0', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`${OLD_ITEMS_SQL};
    INSERT INTO items (id, spec, created_at, updated_at) VALUES ('old-1', '旧数据', 1, 1);`);
  ensureTaxedColumn(db);
  assert.ok(tableColumns(db).includes('taxed'));
  const row = db.prepare('SELECT id, taxed FROM items WHERE id = ?').get('old-1');
  assert.equal(row.id, 'old-1');
  assert.equal(row.taxed, 0);
  db.close();
});

test('ensureTaxedColumn 幂等：已含 taxed 列的库重复调用不重复加列', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`${OLD_ITEMS_SQL};
    ALTER TABLE items ADD COLUMN taxed INTEGER NOT NULL DEFAULT 0;
    INSERT INTO items (id, taxed, created_at, updated_at) VALUES ('new-1', 1, 1, 1);`);
  ensureTaxedColumn(db);
  ensureTaxedColumn(db);
  assert.equal(tableColumns(db).filter((c) => c === 'taxed').length, 1);
  const row = db.prepare('SELECT id, taxed FROM items WHERE id = ?').get('new-1');
  assert.equal(row.id, 'new-1');
  assert.equal(row.taxed, 1);
  db.close();
});
