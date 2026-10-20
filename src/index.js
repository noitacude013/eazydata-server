const { createApp } = require('./app');
const { createDb } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.EAZYDATA_TOKEN || 'dev-token';
const DB_PATH = process.env.DB_PATH || './data.db';

const { app } = createApp({ token: TOKEN, db: createDb(DB_PATH) });
app.listen(PORT, () => {
  console.log(`EazyData server listening on port ${PORT}`);
});
