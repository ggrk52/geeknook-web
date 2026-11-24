import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
import workerDefault, { StockLedgerDO } from './src/index.js';

class MockStorage {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    return this.map.get(key);
  }
  async put(key, val) {
    if (typeof key === 'object') {
      for (const [name, value] of Object.entries(key)) this.map.set(name, structuredClone(value));
    } else {
      this.map.set(key, structuredClone(val));
    }
  }
}

export function createWorkerHarness(overrides = {}) {
  const storage = new MockStorage();
  const ctx = {
    storage,
    blockConcurrencyWhile: async (fn) => { await fn(); }
  };
  const env = {
    PUBLIC_STOCK_CAP: '6',
    MAX_PUBLIC_QTY_PER_ITEM: '20',
    ALLOWED_ORIGINS: 'https://geeknook.ru,https://ggrk52.github.io',
    STOCK_ADMIN_KEY: 'super-secret-admin-key-2026',
    ...overrides,
    STOCK_LEDGER: {
      idFromName: (name) => name,
      get: () => ledger
    }
  };
  const ledger = new StockLedgerDO(ctx, env);
  const handler = workerDefault.fetch ? workerDefault : workerDefault.default;
  return {
    env,
    fetch: (request) => handler.fetch(request, env)
  };
}

if (isMain) {
  const stockJsonPath = path.resolve(process.cwd(), 'data/stock.json');
  const stockDoc = JSON.parse(fs.readFileSync(stockJsonPath, 'utf8'));
  const harness = createWorkerHarness();

  const call = (urlPath, method = 'GET', body = null, headers = {}) => {
    const req = new Request(`https://geeknook-stock.workers.dev${urlPath}`, {
      method,
      headers: {
        Origin: 'https://geeknook.ru',
        'CF-Connecting-IP': '203.0.113.10',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return harness.fetch(req);
  };

  // 1. Disallowed CORS origin rejected with 403
  const badOriginRes = await call('/stock', 'GET', null, { Origin: 'https://evil-attacker.example' });
  assert.equal(badOriginRes.status, 403);

  // 2. Unauthenticated seed & admin_list rejected with 401
  const noAuthSeed = await call('/admin/seed', 'POST', { items: stockDoc.items });
  assert.equal(noAuthSeed.status, 401);
  const badAuthList = await call('/admin/list', 'POST', {}, { 'X-Admin-Key': 'wrong-key' });
  assert.equal(badAuthList.status, 401);

  // 3. Seed full 28 SKUs with valid admin key
  const seedRes = await call('/admin/seed', 'POST', {
    stockDate: stockDoc.stockDate,
    snapshotHash: stockDoc.snapshotHash,
    items: stockDoc.items
  }, { 'X-Admin-Key': harness.env.STOCK_ADMIN_KEY });
  assert.equal(seedRes.status, 200);
  const seedData = await seedRes.json();
  assert.equal(seedData.imported, 28);
  assert.equal(seedData.items['20240410'].stock, 437);

  // 4. Public GET /stock exposes ONLY capped counts (<=6) and strips spent/movements
  const pubRes = await call('/stock', 'GET');
  assert.equal(pubRes.status, 200);
  const pubData = await pubRes.json();
  assert.equal(pubData.mode, 'public');
  assert.equal(pubData.capped, true);
  assert.equal(pubData.items['20240410'].stock, 6);
  assert.equal(pubData.items['20240410'].capped, true);
  assert.equal(pubData.items['20240410'].initialSpent, undefined);
  assert.equal(pubData.items['20240408'].stock, 1);
  assert.equal(pubData.items['20240408'].capped, false);
  assert.equal(pubData.recentMovements, undefined);

  // 5. Public check allows >6 (up to 20) when real stock is 437, rejects over retail limit
  const okCheck = await call('/check', 'POST', { items: [{ code: '20240410', quantity: 10 }] });
  assert.equal(okCheck.status, 200);
  const overCheck = await call('/check', 'POST', { items: [{ code: '20240410', quantity: 25 }] });
  assert.equal(overCheck.status, 409);

  // 6. Atomic commit of last 20240408 succeeds once, second order gets 409 Conflict
  const commit1 = await call('/commit', 'POST', {
    orderNumber: 'GN-1C-100001',
    orderType: 'quick_buy',
    items: [{ code: '20240408', quantity: 1 }]
  });
  assert.equal(commit1.status, 200);
  const c1Json = await commit1.json();
  assert.equal(c1Json.items['20240408'].stock, 0);

  // Idempotent retry of same orderNumber returns 200 alreadyCommitted
  const retry1 = await call('/commit', 'POST', {
    orderNumber: 'GN-1C-100001',
    orderType: 'quick_buy',
    items: [{ code: '20240408', quantity: 1 }]
  });
  assert.equal(retry1.status, 200);
  assert.equal((await retry1.json()).alreadyCommitted, true);

  // Different orderNumber for sold-out 20240408 fails atomically with 409
  const commit2 = await call('/commit', 'POST', {
    orderNumber: 'GN-1C-100002',
    orderType: 'quick_buy',
    items: [{ code: '20240408', quantity: 1 }]
  });
  assert.equal(commit2.status, 409);

  // 7. Admin list reveals real post-order counts (0 stock, 3 spent) & adjust works with key
  const adminRes = await call('/admin/list', 'POST', {}, { 'X-Admin-Key': harness.env.STOCK_ADMIN_KEY });
  const adminData = await adminRes.json();
  assert.equal(adminData.items['20240408'].stock, 0);
  assert.equal(adminData.items['20240408'].totalSpent, 3);
  assert.equal(adminData.recentMovements[0].orderNumber, 'GN-1C-100001');

  const adjRes = await call('/admin/adjust', 'POST', { code: '20240408', delta: 2 }, { 'X-Admin-Key': harness.env.STOCK_ADMIN_KEY });
  assert.equal(adjRes.status, 200);
  assert.equal((await adjRes.json()).items['20240408'].stock, 2);

  // 8. Commit rate limiting triggers 429 after 6 requests in 60s from same IP
  let saw429 = false;
  for (let i = 0; i < 8; i++) {
    const r = await call('/commit', 'POST', {
      orderNumber: `GN-RL-${i}`,
      items: [{ code: '20240410', quantity: 1 }]
    });
    if (r.status === 429) { saw429 = true; break; }
  }
  assert.equal(saw429, true);

  console.log('CLOUDFLARE_WORKER_TESTS_PASSED');
}

if (isMain) {
  const secret = 'webhook-test-only-'.repeat(3);
  const host = 'https://stock.example';
  const webhook = createWorkerHarness({ STOCK_WEBHOOK_MODE: 'active', STOCK_WEBHOOK_SECRET: secret });
  const send = (path, body, headers = {}) => webhook.fetch(new Request(host + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }));
  const initialStock = 4;
  const seeded = await send('/admin/seed', {
    items: { '202404205': { code: '202404205', stock: initialStock, initialStock, price: 19999 } }
  }, { 'X-Admin-Key': webhook.env.STOCK_ADMIN_KEY });
  assert.equal(seeded.status, 200);

  const orderNumber = 'GN-123456';
  const body = { 'Номер_заказа_сайта': orderNumber, products: [{ sku: '1000830016', quantity: 1 }] };
  const publicCommit = { orderNumber, items: [{ code: '202404205', quantity: 1 }] };
  assert.equal((await send('/commit', publicCommit)).status, 409);
  assert.equal((await send('/webhooks/tilda/invalid', body)).status, 404);
  assert.equal((await send('/webhooks/tilda/' + secret, body)).status, 200);
  assert.equal((await send('/webhooks/tilda/' + secret, body)).status, 200);
  assert.equal((await send('/webhooks/tilda/' + secret, { ...body, products: [{ sku: '1000830016', quantity: 2 }] })).status, 409);
  assert.equal((await send('/commit', publicCommit)).status, 200);
  const stock = await (await webhook.fetch(new Request(host))).json();
  assert.equal(stock.items['202404205'].stock, initialStock - 1);
  console.log('TILDA_WEBHOOK_TESTS_PASSED');
}
