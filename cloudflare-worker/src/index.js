import stockSkuMap from './stock-sku-map.json' with { type: 'json' };
/**
 * GeekNook Atomic Stock Service (Cloudflare Worker + Durable Object)
 *
 * Security & privacy guarantees:
 * - Full inventory counts, initialSpent, and order logs live strictly inside Durable Object storage.
 * - Public GET /stock returns stock capped at PUBLIC_STOCK_CAP (default 6 -> "In stock"), never exposing warehouse depth.
 * - POST /check and POST /commit validate and deduct real stock atomically inside one single-writer Durable Object.
 * - Admin routes require env.STOCK_ADMIN_KEY (checked with constant-time SHA-256 comparison).
 */

const DEFAULT_PUBLIC_CAP = 6;
const DEFAULT_MAX_PUBLIC_QTY = 20;
const RATE_WINDOW_SEC = 60;
const RATE_MAX_COMMITS_PER_IP = 6;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://geeknook.ru',
  'https://www.geeknook.ru',
  'https://ggrk52.github.io'
];

function parseAllowedOrigins(env) {
  const set = new Set(DEFAULT_ALLOWED_ORIGINS);
  const raw = String(env?.ALLOWED_ORIGINS || '').trim();
  if (raw) {
    for (const part of raw.split(',')) {
      const clean = part.trim().replace(/\/+$/, '');
      if (clean) set.add(clean);
    }
  }
  return set;
}

function isOriginAllowed(origin, env) {
  if (!origin) return true; // Non-browser CLI / server-to-server requests (admin key still enforced on admin routes)
  const normalized = origin.replace(/\/+$/, '');
  if (parseAllowedOrigins(env).has(normalized)) return true;
  try {
    const url = new URL(normalized);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch (_) {
    return false;
  }
}

function buildSecurityHeaders(origin, env) {
  const allowOrigin = origin && isOriginAllowed(origin, env)
    ? origin.replace(/\/+$/, '')
    : 'https://geeknook.ru';
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(payload, status = 200, origin = '', env = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: buildSecurityHeaders(origin, env)
  });
}

async function sha256Bytes(value) {
  const data = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

async function timingSafeSecretEquals(provided, expected) {
  if (!expected || typeof expected !== 'string' || !provided || typeof provided !== 'string') {
    return false;
  }
  const [a, b] = await Promise.all([sha256Bytes(provided), sha256Bytes(expected)]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function extractAdminKey(request, body = {}) {
  const headerKey = request.headers.get('X-Admin-Key') || '';
  if (headerKey) return headerKey.trim();
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return typeof body.adminKey === 'string' ? body.adminKey.trim() : '';
}

function sanitizePositiveInt(val, fallback = 0) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function normalizeSeedItem(raw) {
  const code = String(raw?.code || '').trim();
  if (!code) return null;
  const initialStock = sanitizePositiveInt(raw?.initialStock ?? (sanitizePositiveInt(raw?.stock) + sanitizePositiveInt(raw?.initialSpent)));
  const initialSpent = sanitizePositiveInt(raw?.initialSpent);
  const stock = raw?.stock !== undefined ? sanitizePositiveInt(raw.stock) : Math.max(0, initialStock - initialSpent);
  return {
    code,
    name: String(raw?.name || code).slice(0, 240),
    category: String(raw?.category || 'Аксессуары').slice(0, 80),
    price: sanitizePositiveInt(raw?.price),
    initialStock: Math.max(initialStock, stock + initialSpent),
    initialSpent,
    stock
  };
}

function toPublicView(state, publicCap) {
  const items = {};
  const baseItems = state.items || {};
  const deductions = state.deductions || {};
  for (const [code, base] of Object.entries(baseItems)) {
    const orderSpent = sanitizePositiveInt(deductions[code]);
    const realStock = Math.max(0, sanitizePositiveInt(base.initialStock) - sanitizePositiveInt(base.initialSpent) - orderSpent);
    items[code] = {
      code,
      price: sanitizePositiveInt(base.price),
      stock: Math.min(realStock, publicCap),
      capped: realStock >= publicCap
    };
  }
  return {
    ok: true,
    success: true,
    mode: 'public',
    capped: true,
    publicCap,
    stockDate: state.stockDate || '',
    snapshotHash: state.snapshotHash || '',
    updatedAt: state.updatedAt || '',
    items
  };
}

function toAdminView(state) {
  const items = {};
  const baseItems = state.items || {};
  const deductions = state.deductions || {};
  for (const [code, base] of Object.entries(baseItems)) {
    const initialStock = sanitizePositiveInt(base.initialStock);
    const initialSpent = sanitizePositiveInt(base.initialSpent);
    const orderSpent = sanitizePositiveInt(deductions[code]);
    const totalSpent = initialSpent + orderSpent;
    const stock = Math.max(0, initialStock - totalSpent);
    items[code] = {
      code,
      name: base.name || code,
      category: base.category || 'Аксессуары',
      price: sanitizePositiveInt(base.price),
      initialStock,
      initialSpent,
      orderSpent,
      totalSpent,
      stock
    };
  }
  return {
    ok: true,
    success: true,
    mode: 'admin',
    capped: false,
    stockDate: state.stockDate || '',
    snapshotHash: state.snapshotHash || '',
    updatedAt: state.updatedAt || '',
    items,
    recentMovements: Array.isArray(state.movements) ? state.movements.slice(0, 50) : []
  };
}

function aggregateRequestedItems(rawItems = [], maxQtyPerItem = DEFAULT_MAX_PUBLIC_QTY) {
  const counts = new Map();
  if (!Array.isArray(rawItems)) return { counts, overLimitCode: '' };
  for (const row of rawItems) {
    const code = String(row?.code || '').trim();
    if (!code) continue;
    const qty = Math.max(1, parseInt(row?.quantity, 10) || 1);
    const nextQty = (counts.get(code) || 0) + qty;
    if (nextQty > maxQtyPerItem) {
      return { counts, overLimitCode: code };
    }
    counts.set(code, nextQty);
  }
  return { counts, overLimitCode: '' };
}

export class StockLedgerDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.state = null;
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get('ledger');
      this.state = saved || {
        stockDate: '',
        snapshotHash: '',
        updatedAt: '',
        items: {},
        deductions: {},
        committedOrders: [],
        movements: [],
        rateLimits: {}
      };
    });
  }

  async persist() {
    this.state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put('ledger', this.state);
  }

  checkRateLimit(ip) {
    const cleanIp = String(ip || '0.0.0.0').slice(0, 64);
    const nowSec = Math.floor(Date.now() / 1000);
    const all = this.state.rateLimits || {};
    const recent = (Array.isArray(all[cleanIp]) ? all[cleanIp] : []).filter(t => (nowSec - t) < RATE_WINDOW_SEC);
    if (recent.length >= RATE_MAX_COMMITS_PER_IP) {
      all[cleanIp] = recent;
      this.state.rateLimits = all;
      return false;
    }
    recent.push(nowSec);
    all[cleanIp] = recent;
    // Prune stale IPs periodically
    for (const [k, list] of Object.entries(all)) {
      if (!Array.isArray(list) || !list.some(t => (nowSec - t) < RATE_WINDOW_SEC)) {
        delete all[k];
      }
    }
    this.state.rateLimits = all;
    return true;
  }

  realStockFor(code) {
    const base = this.state.items?.[code];
    if (!base) return 0;
    const spent = sanitizePositiveInt(base.initialSpent) + sanitizePositiveInt(this.state.deductions?.[code]);
    return Math.max(0, sanitizePositiveInt(base.initialStock) - spent);
  }

  evaluateAvailability(counts) {
    const shortages = [];
    for (const [code, reqQty] of counts.entries()) {
      const avail = this.realStockFor(code);
      if (reqQty > avail) {
        shortages.push({
          code,
          available: avail > 5 ? 6 : avail,
          capped: avail > 5,
          requested: reqQty
        });
      }
    }
    return shortages;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'geeknook-internal.invalid' && url.pathname === '/webhook-probe') {
      if (request.method === 'POST') {
        const receipt = await request.json();
        await this.ctx.storage.put(receipt.kind === 'setup' ? 'webhookSetupProbe' : 'webhookProbe', receipt);
        return new Response(null, { status: 204 });
      }
      return jsonResponse({
        probe: await this.ctx.storage.get('webhookProbe') ?? null,
        setupProbe: await this.ctx.storage.get('webhookSetupProbe') ?? null
      }, 200, '', this.env);
    }
    const origin = request.headers.get('Origin') || '';
    const publicCap = sanitizePositiveInt(this.env?.PUBLIC_STOCK_CAP, DEFAULT_PUBLIC_CAP) || DEFAULT_PUBLIC_CAP;
    const maxQty = sanitizePositiveInt(this.env?.MAX_PUBLIC_QTY_PER_ITEM, DEFAULT_MAX_PUBLIC_QTY) || DEFAULT_MAX_PUBLIC_QTY;

    if (request.method === 'GET') {
      return jsonResponse(toPublicView(this.state, publicCap), 200, origin, this.env);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405, origin, this.env);
    }

    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400, origin, this.env);
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    const action = String(
      body.action ||
      (path.endsWith('/admin/list') ? 'admin_list' :
        path.endsWith('/admin/seed') ? 'seed' :
          path.endsWith('/admin/adjust') ? 'adjust' :
            path.endsWith('/admin/reset') ? 'reset' :
              path.endsWith('/commit') ? 'commit' :
                path.endsWith('/check') ? 'check' : '')
    );

    if (action === 'check') {
      const { counts, overLimitCode } = aggregateRequestedItems(body.items, maxQty);
      if (overLimitCode) {
        return jsonResponse({
          ok: false,
          outOfStock: true,
          shortages: [{ code: overLimitCode, available: maxQty, capped: true }],
          error: `Для онлайн-заказа доступно не более ${maxQty} шт. одного артикула. Для опта оформите B2B-заявку.`
        }, 409, origin, this.env);
      }
      const shortages = this.evaluateAvailability(counts);
      if (shortages.length > 0) {
        const first = shortages[0];
        return jsonResponse({
          ok: false,
          outOfStock: true,
          shortages,
          error: first.available === 0
            ? 'Товар временно отсутствует на складе'
            : (first.available <= 5
              ? `Осталось всего ${first.available} шт. — больше оформить нельзя`
              : 'Превышен доступный остаток на складе для онлайн-заказа'),
          ...toPublicView(this.state, publicCap)
        }, 409, origin, this.env);
      }
      return jsonResponse({ ok: true, shortages: [], ...toPublicView(this.state, publicCap) }, 200, origin, this.env);
    }

    if (action === 'commit') {
      const trusted = url.hostname === 'geeknook-internal.invalid' && path === '/webhook-commit';
      const webhookOnly = String(this.env.STOCK_WEBHOOK_MODE || '') === 'active';
      const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
      if (!trusted && !webhookOnly && !this.checkRateLimit(clientIp)) {
        return jsonResponse({ ok: false, error: 'Слишком много запросов. Подождите минуту.' }, 429, origin, this.env);
      }

      const orderNumber = String(body.orderNumber || '').trim();
      if (!orderNumber || !/^[A-Z0-9_-]{4,48}$/i.test(orderNumber)) {
        return jsonResponse({ ok: false, error: 'Некорректный номер заказа' }, 400, origin, this.env);
      }

      const receiptKey = 'tilda-order:' + orderNumber;
      if (webhookOnly && !trusted) {
        // Existing clients can read acknowledgement, but their items never mutate stock.
        const receipt = await this.ctx.storage.get(receiptKey);
        if (!receipt) return jsonResponse({ ok: false, pending: true, error: 'Ожидается подтверждение склада' }, 409, origin, this.env);
        return jsonResponse({ ok: true, alreadyCommitted: true, ...toPublicView(this.state, publicCap) }, 200, origin, this.env);
      }

      if ((trusted && await this.ctx.storage.get(receiptKey)) || (this.state.committedOrders || []).includes(orderNumber)) {
        return jsonResponse({ ok: true, alreadyCommitted: true, ...toPublicView(this.state, publicCap) }, 200, origin, this.env);
      }

      const { counts, overLimitCode } = aggregateRequestedItems(body.items, maxQty);
      if (overLimitCode) {
        return jsonResponse({ ok: false, error: 'Превышен розничный лимит количества на один заказ' }, 409, origin, this.env);
      }
      if (!counts.size) {
        return jsonResponse({ ok: false, error: 'Пустой список позиций' }, 400, origin, this.env);
      }

      const shortages = this.evaluateAvailability(counts);
      if (shortages.length > 0) {
        const first = shortages[0];
        return jsonResponse({
          ok: false,
          outOfStock: true,
          shortages,
          error: first.available === 0
            ? 'Товар только что закончился на складе'
            : (first.available <= 5
              ? `На складе осталось только ${first.available} шт.`
              : 'Недостаточно товара на складе'),
          ...toPublicView(this.state, publicCap)
        }, 409, origin, this.env);
      }

      const movementItems = [];
      for (const [code, qty] of counts.entries()) {
        this.state.deductions[code] = sanitizePositiveInt(this.state.deductions[code]) + qty;
        movementItems.push({ code, qty });
      }
      this.state.committedOrders.push(orderNumber);
      if (this.state.committedOrders.length > 500) {
        this.state.committedOrders = this.state.committedOrders.slice(-500);
      }
      this.state.movements.unshift({
        timestamp: new Date().toISOString(),
        orderNumber,
        type: body.orderType === 'quick_buy' ? 'quick_buy' : 'cart',
        items: movementItems
      });
      if (this.state.movements.length > 50) {
        this.state.movements.length = 50;
      }

      if (trusted) {
        this.state.updatedAt = new Date().toISOString();
        await this.ctx.storage.put({ ledger: this.state, [receiptKey]: true });
      } else {
        await this.persist();
      }
      return jsonResponse({ ok: true, committed: true, ...toPublicView(this.state, publicCap) }, 200, origin, this.env);
    }

    // Admin routes strictly enforce server secret STOCK_ADMIN_KEY
    const configuredSecret = String(this.env?.STOCK_ADMIN_KEY || '');
    if (!configuredSecret) {
      return jsonResponse({ ok: false, error: 'STOCK_ADMIN_KEY is not configured on Worker' }, 503, origin, this.env);
    }
    const providedSecret = extractAdminKey(request, body);
    const isAdmin = await timingSafeSecretEquals(providedSecret, configuredSecret);
    if (!isAdmin) {
      return jsonResponse({ ok: false, error: 'Unauthorized: неверный пароль администратора' }, 401, origin, this.env);
    }

    if (action === 'admin_list') {
      return jsonResponse(toAdminView(this.state), 200, origin, this.env);
    }

    if (action === 'seed') {
      const rawItems = Array.isArray(body.items) ? body.items : Object.values(body.items || {});
      const nextItems = {};
      for (const raw of rawItems) {
        const norm = normalizeSeedItem(raw);
        if (norm) nextItems[norm.code] = norm;
      }
      if (!Object.keys(nextItems).length) {
        return jsonResponse({ ok: false, error: 'Пустой прайс для импорта' }, 400, origin, this.env);
      }
      this.state.items = nextItems;
      this.state.stockDate = String(body.stockDate || new Date().toISOString().slice(0, 10));
      this.state.snapshotHash = String(body.snapshotHash || '');
      if (!body.keepDeductions) {
        this.state.deductions = {};
        this.state.committedOrders = [];
        this.state.movements = [];
      }
      await this.persist();
      return jsonResponse({ ok: true, imported: Object.keys(nextItems).length, ...toAdminView(this.state) }, 200, origin, this.env);
    }

    if (action === 'adjust') {
      const code = String(body.code || '').trim();
      const targetItem = this.state.items?.[code];
      if (!targetItem) {
        return jsonResponse({ ok: false, error: 'Артикул не найден' }, 404, origin, this.env);
      }
      const delta = parseInt(body.delta, 10);
      if (!Number.isFinite(delta) || delta === 0) {
        return jsonResponse({ ok: false, error: 'Некорректная корректировка' }, 400, origin, this.env);
      }
      const currentReal = this.realStockFor(code);
      const nextReal = Math.max(0, currentReal + delta);
      const actualDelta = nextReal - currentReal;
      if (actualDelta > 0) {
        targetItem.initialStock = sanitizePositiveInt(targetItem.initialStock) + actualDelta;
      } else if (actualDelta < 0) {
        this.state.deductions[code] = sanitizePositiveInt(this.state.deductions[code]) + Math.abs(actualDelta);
      }
      this.state.movements.unshift({
        timestamp: new Date().toISOString(),
        orderNumber: 'ADMIN-ADJ',
        type: 'adjust',
        items: [{ code, qty: -actualDelta }]
      });
      if (this.state.movements.length > 50) this.state.movements.length = 50;
      await this.persist();
      return jsonResponse({ ok: true, ...toAdminView(this.state) }, 200, origin, this.env);
    }

    if (action === 'reset') {
      this.state.deductions = {};
      this.state.committedOrders = [];
      this.state.movements = [];
      await this.persist();
      return jsonResponse({ ok: true, ...toAdminView(this.state) }, 200, origin, this.env);
    }

    return jsonResponse({ ok: false, error: 'Unknown action' }, 400, origin, this.env);
  }
}

// Verify the Tilda connection before enabling inventory writes.
async function verifyTildaWebhook(request, env, secret) {
  const configured = String(env.STOCK_WEBHOOK_SECRET || '');
  if (configured.length < 32 || !await timingSafeSecretEquals(secret, configured)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const ledger = env.STOCK_LEDGER.get(env.STOCK_LEDGER.idFromName('global-stock-v1'));
  const internalUrl = 'https://geeknook-internal.invalid/webhook-probe';
  if (request.method === 'GET') return ledger.fetch(new Request(internalUrl));
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST', 'Cache-Control': 'no-store' } });
  }
  // Bound body reads even when the sender omits Content-Length.
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let raw = '';
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        raw = '';
        break;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  }
  const parseJson = value => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (_) { return null; }
  };
  const json = parseJson(raw);
  const payload = json && typeof json === 'object' ? json : Object.fromEntries(new URLSearchParams(raw));
  const payment = parseJson(payload.payment ?? payload.tildapayment);
  const arrayProducts = [payload.products, payload.goods, payment?.products, payment?.goods]
    .map(parseJson).find(Array.isArray);
  // URL-encoded forms may flatten nested arrays into PHP-style bracket keys.
  const indexed = new Map();
  const itemKeys = ['sku', 'externalid', 'quantity', 'options', 'uid'];
  for (const field of Object.keys(payload)) {
    const match = field.match(/^(?:(?:payment|tildapayment)\[(?:products|goods)\]|products|goods)\[(\d{1,4})\](?:\[(\w+)\]|$)/);
    if (!match) continue;
    const [, index, key] = match;
    const item = indexed.get(index) || {};
    if (itemKeys.includes(key)) item[key] = payload[field];
    indexed.set(index, item);
  }
  const items = arrayProducts?.length ? arrayProducts : [...indexed.values()];
  const productCount = items.length;
  const itemFields = itemKeys.filter(key => Object.hasOwn(items[0] || {}, key));
  const stockLines = items.map(item => {
    const sku = item?.sku;
    const quantity = String(item?.quantity ?? '');
    const codes = typeof sku === 'string' && Object.hasOwn(stockSkuMap, sku) ? stockSkuMap[sku] : null;
    return codes?.length && /^[1-9]\d{0,2}$/.test(quantity) ? { codes, quantity: Number(quantity) } : null;
  });
  {
    const receipt = {
      receivedAt: new Date().toISOString(),
      kind: payload.test === 'test' && !productCount ? 'setup' : 'submission',
      bodyFormat: size > 65536 ? 'too_large' : json && typeof json === 'object' ? 'json' :
        request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded') ? 'form' : 'unknown',
      products: productCount,
      matchedProducts: stockLines.filter(Boolean).length,
      stockLines: stockLines.reduce((sum, codes) => sum + (codes?.codes.length || 0), 0),
      hasPayment: Boolean(payment) || Object.keys(payload).some(key => /^(?:payment|tildapayment)\[/.test(key)),
      orderReference: Boolean(payload['Номер заказа сайта'] || payload['Номер_заказа_сайта'] || payment?.orderid),
      itemFields
    };
    const result = await ledger.fetch(new Request(internalUrl, {
      method: 'POST',
      body: JSON.stringify(receipt)
    }));
    if (!result.ok) return new Response('Diagnostic storage unavailable', { status: 503 });
  }
  if (String(env.STOCK_WEBHOOK_MODE || '') === 'active' && !(payload.test === 'test' && !productCount)) {
    const orderNumber = payload['Номер заказа сайта'] || payload['Номер_заказа_сайта'];
    if (typeof orderNumber !== 'string' || !/^GN-(?:1C-)?[A-Z0-9_-]{4,40}$/i.test(orderNumber) ||
        !productCount || !stockLines.every(Boolean)) {
      return new Response('Order could not be matched to stock', { status: 422 });
    }
    const result = await ledger.fetch(new Request('https://geeknook-internal.invalid/webhook-commit', {
      method: 'POST',
      body: JSON.stringify({
        action: 'commit',
        orderNumber,
        orderType: orderNumber.startsWith('GN-1C-') ? 'quick_buy' : 'cart',
        items: stockLines.flatMap(line => line.codes.map(code => ({ code, quantity: line.quantity })))
      })
    }));
    if (!result.ok) return new Response('Stock could not be confirmed', { status: result.status });
  }
  return new Response('ok', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'geeknook-internal.invalid' || url.pathname === '/webhook-probe') {
      return new Response(null, { status: 404 });
    }
    const webhook = url.pathname.match(/^\/webhooks\/tilda\/([^/]+)$/);
    if (webhook) {
      let secret;
      try {
        secret = decodeURIComponent(webhook[1]);
      } catch (_) {
        return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      return verifyTildaWebhook(request, env, secret);
    }
    const origin = request.headers.get('Origin') || '';
    if (!isOriginAllowed(origin, env)) {
      return jsonResponse({ ok: false, error: 'Forbidden: Origin not allowed' }, 403, origin, env);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildSecurityHeaders(origin, env) });
    }
    const id = env.STOCK_LEDGER.idFromName('global-stock-v1');
    const stub = env.STOCK_LEDGER.get(id);
    return stub.fetch(request);
  }
};
