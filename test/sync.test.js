const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

const TOKEN = 'secret-token';

function makeItem(overrides = {}) {
  return {
    id: overrides.id ?? 'row-1',
    spec: overrides.spec ?? '500ml/瓶',
    price_cents: overrides.price_cents ?? 1250,
    company: overrides.company ?? '某某公司',
    remark: overrides.remark ?? '',
    date: overrides.date ?? '2026-07-30',
    created_at: overrides.created_at ?? 1000,
    updated_at: overrides.updated_at ?? 2000,
    deleted: overrides.deleted ?? 0,
    taxed: overrides.taxed ?? 0,
  };
}

async function withServer(fn, { token = TOKEN } = {}) {
  const { app } = createApp({ token, db: createDb() });
  const server = app.listen(0);
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('未带 token 返回 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: 0 }),
    });
    assert.equal(res.status, 401);
  });
});

test('push 新行后可被 pull 到', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    const item = makeItem();
    const pushRes = await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers, body: JSON.stringify({ items: [item] }),
    });
    assert.equal(pushRes.status, 200);
    const pushBody = await pushRes.json();
    assert.deepEqual(pushBody, { saved: ['row-1'], rejected: [] });

    const pullRes = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers, body: JSON.stringify({ since: 0 }),
    });
    const pullBody = await pullRes.json();
    assert.equal(pullBody.items.length, 1);
    assert.equal(pullBody.items[0].spec, '500ml/瓶');
    assert.equal(pullBody.server_time > 0, true);
  });
});

test('pull 按 since 增量返回且含软删除行', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers, body: JSON.stringify({ items: [makeItem({ id: 'a', updated_at: 100 })] }),
    });
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ id: 'b', updated_at: 200, deleted: 1 })] }),
    });
    const res = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers, body: JSON.stringify({ since: 150 }),
    });
    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].id, 'b');
    assert.equal(body.items[0].deleted, 1);
  });
});

test('push 旧版本行被拒绝（last-write-wins）', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ updated_at: 2000, spec: '新版' })] }),
    });
    const res = await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ updated_at: 1500, spec: '旧版' })] }),
    });
    const body = await res.json();
    assert.deepEqual(body, { saved: [], rejected: ['row-1'] });

    const pull = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers, body: JSON.stringify({ since: 0 }),
    });
    const pullBody = await pull.json();
    assert.equal(pullBody.items[0].spec, '新版');
  });
});

test('同版本 updated_at 允许覆盖', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ updated_at: 2000, spec: 'A' })] }),
    });
    const res = await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ updated_at: 2000, spec: 'B' })] }),
    });
    const body = await res.json();
    assert.deepEqual(body, { saved: ['row-1'], rejected: [] });
  });
});

test('push/pull 携带 taxed 字段', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ items: [makeItem({ id: 't1', taxed: 1 })] }),
    });
    const pull = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers, body: JSON.stringify({ since: 0 }),
    });
    const body = await pull.json();
    assert.equal(body.items[0].taxed, 1);
  });
});

test('push 未携带 taxed 时按 0 存储', async () => {
  await withServer(async (base) => {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
    const item = makeItem({ id: 't2' });
    delete item.taxed;
    await fetch(`${base}/api/sync/push`, {
      method: 'POST', headers, body: JSON.stringify({ items: [item] }),
    });
    const pull = await fetch(`${base}/api/sync/pull`, {
      method: 'POST', headers, body: JSON.stringify({ since: 0 }),
    });
    const body = await pull.json();
    assert.equal(body.items[0].taxed, 0);
  });
});
