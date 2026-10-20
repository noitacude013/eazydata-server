const express = require('express');
const { createDb } = require('./db');
const { authMiddleware } = require('./auth');

function createApp({ token = 'dev-token', db = createDb() } = {}) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  const auth = authMiddleware(token);

  app.post('/api/sync/pull', auth, (req, res) => {
    const since = Number(req.body?.since ?? 0);
    const rows = db.prepare(
      'SELECT * FROM items WHERE updated_at > ? ORDER BY updated_at ASC'
    ).all(since);
    res.json({ items: rows, server_time: Date.now() });
  });

  app.post('/api/sync/push', auth, (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const saved = [];
    const rejected = [];
    const upsert = db.prepare(`
      INSERT INTO items (id, spec, price_cents, company, remark, date, created_at, updated_at, deleted, taxed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        spec = excluded.spec,
        price_cents = excluded.price_cents,
        company = excluded.company,
        remark = excluded.remark,
        date = excluded.date,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted = excluded.deleted,
        taxed = excluded.taxed
      WHERE excluded.updated_at >= items.updated_at
    `);
    for (const it of items) {
      const info = upsert.run(
        it.id, it.spec ?? '', it.price_cents ?? 0, it.company ?? '',
        it.remark ?? '', it.date ?? null, it.created_at, it.updated_at,
        it.deleted ? 1 : 0, it.taxed ? 1 : 0
      );
      if (info.changes > 0) saved.push(it.id);
      else rejected.push(it.id);
    }
    res.json({ saved, rejected });
  });

  return { app, db };
}

module.exports = { createApp };
