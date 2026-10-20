const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');

test('GET /api/health 返回 ok 与时间戳', async () => {
  const { app } = createApp({ token: 't', db: createDb() });
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(typeof body.time, 'number');
  } finally {
    server.close();
  }
});
