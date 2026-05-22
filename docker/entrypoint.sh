#!/bin/sh
set -e

echo "[entrypoint] waiting for database..."
node -e "
const url = new URL(process.env.DATABASE_URL);
const net = require('net');
const host = url.hostname, port = parseInt(url.port || '5432', 10);
const tryOnce = () => new Promise((res) => {
  const s = net.createConnection({ host, port });
  s.once('connect', () => { s.end(); res(true); });
  s.once('error', () => res(false));
});
(async () => {
  for (let i = 0; i < 60; i++) {
    if (await tryOnce()) { console.log('[entrypoint] db reachable'); process.exit(0); }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('[entrypoint] db not reachable after 60s');
  process.exit(1);
})();
"

echo "[entrypoint] syncing schema..."
PRISMA_BIN="/app/node_modules/prisma/build/index.js"
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  node "$PRISMA_BIN" migrate deploy
else
  node "$PRISMA_BIN" db push --skip-generate --accept-data-loss
fi

echo "[entrypoint] starting app..."
exec "$@"
