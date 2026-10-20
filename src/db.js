const { DatabaseSync } = require('node:sqlite');

function ensureTaxedColumn(db) {
  const cols = db.prepare('PRAGMA table_info(items)').all();
  if (!cols.some((c) => c.name === 'taxed')) {
    db.exec('ALTER TABLE items ADD COLUMN taxed INTEGER NOT NULL DEFAULT 0');
  }
}

function createDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      spec TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      company TEXT NOT NULL DEFAULT '',
      remark TEXT NOT NULL DEFAULT '',
      date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      taxed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
  `);
  ensureTaxedColumn(db);
  return db;
}

module.exports = { createDb, ensureTaxedColumn };
