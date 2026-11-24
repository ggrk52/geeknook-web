// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setupPageRoutes, checkZeroOverflow } = require('./test-helpers');

const WORKER_TEST_URL = 'https://stock-api.geeknook.test/api/stock';
const ADMIN_SECRET = 'gn-worker-secret-2026';

async function attachRealWorkerMock(page) {
  const workerMod = await import(pathToFileURL(path.resolve(process.cwd(), 'cloudflare-worker/test-worker.mjs')).href);
  const stockDoc = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/stock.json'), 'utf8'));
  const harness = workerMod.createWorkerHarness({ STOCK_ADMIN_KEY: ADMIN_SECRET });

  await harness.fetch(new Request(WORKER_TEST_URL + '/admin/seed', {
    method: 'POST',
    headers: {
      Origin: 'https://geeknook.ru',
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_SECRET
    },
    body: JSON.stringify({
      stockDate: stockDoc.stockDate,
      snapshotHash: stockDoc.snapshotHash,
      items: stockDoc.items
    })
  }));

  await page.addInitScript((workerUrl) => {
    window.GEEKNOOK_STOCK_API_URL = workerUrl;
  }, WORKER_TEST_URL);

  await page.route('https://stock-api.geeknook.test/**', async (route) => {
    const req = route.request();
    const res = await harness.fetch(new Request(req.url(), {
      method: req.method(),
      headers: req.headers(),
      body: req.postData() || undefined
    }));
    const bodyText = await res.text();
    const headersObj = {};
    res.headers.forEach((v, k) => { headersObj[k] = v; });
    await route.fulfill({ status: res.status, headers: headersObj, body: bodyText });
  });
}

test.describe('Live Stock Management & Cloudflare Worker Security', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageRoutes(page);
  });

  test('public catalog hides real warehouse depth behind capped public view and blocks unavailable items', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.GEEKNOOK_DATA?.stock);

    const publicSummary = await page.evaluate(() => {
      const api = window.GEEKNOOK_DATA.stock;
      const htmlSrc = document.documentElement.innerHTML;
      return {
        skuCount: api.getAllInventory().length,
        light80: api.getByCode('20240408'),
        light100: api.getByCode('20240410'),
        switchPad: api.getByCode('202404209'),
        iphoneWalnut: api.getByCode('202404220'),
        doubleMatStock: api.getVariantStock('desk-mat-double', '90 × 45 см'),
        magCatchStock: api.getVariantStock('magnetic-catch', ''),
        stealthKitStock: api.getVariantStock('stealth-kit', ''),
        hasAdminHashLeak: htmlSrc.includes('fea6984cbeec1cc07a77f91fd43dfc97')
      };
    });

    expect(publicSummary.skuCount).toBe(28);
    expect(publicSummary.light80).toMatchObject({ stock: 1, capped: false });
    // Large stock counts must be capped at 6 in public products-data.js
    expect(publicSummary.light100).toMatchObject({ stock: 6, capped: true });
    expect(publicSummary.switchPad).toMatchObject({ stock: 6, capped: true, price: 2999 });
    expect(publicSummary.iphoneWalnut).toMatchObject({ stock: 6, capped: true, price: 4999 });
    expect(publicSummary.doubleMatStock).toBe(0);
    expect(publicSummary.magCatchStock).toBe(0);
    expect(publicSummary.stealthKitStock).toBe(0);
    expect(publicSummary.hasAdminHashLeak).toBe(false);

    // Public navigation / footers must NOT expose links to stock.html
    await expect(page.locator('a[href*="stock.html"]')).toHaveCount(0);

    // Out-of-stock card disables quick-buy and quick-add buttons
    const doubleCard = page.locator('#desk-mat-double');
    await expect(doubleCard.locator('.card-stock-indicator')).toHaveClass(/out-of-stock/);
    await expect(doubleCard.locator('.stock-text')).toContainText('Нет в наличии');
    await expect(doubleCard.locator('.btn-card-one-click')).toBeDisabled();
    await expect(doubleCard.locator('.btn-card-quick-add')).toBeDisabled();

    // QuickView & category pages hide large stock numbers and allow >6 when capped
    await page.evaluate(() => window.geekNookApp.openQuickView('phone-dock'));
    const qv = page.locator('#quickViewModal');
    await expect(qv.locator('.qv-live-stock-badge')).toContainText('В наличии');
    await qv.locator('.option-chip[data-val="Орех (Walnut)"]').click();
    await expect(qv.locator('.qv-verified-article')).toHaveText('202404220');
    await qv.locator('.btn-close-modal').click();

    await page.goto('/kovriki-dlya-stola.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#desk-mat-double .btn-buy')).toBeDisabled();
    await expect(page.locator('#desk-mat-light .cat-stock-line')).toContainText('Осталось: 1 шт.');
    await page.locator('#desk-mat-light .size-btn').nth(1).click();
    await expect(page.locator('#desk-mat-light .cat-stock-line')).toContainText('В наличии');

    await page.goto('/kabel-menedzhment.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#magnetic-cable-catch .btn-card-buy')).toBeDisabled();
    await expect(page.locator('#stealth-cable-kit .btn-card-buy')).toBeDisabled();
  });

  test('Cloudflare Worker deducts stock atomically across reloads and authenticates stock.html server-side', async ({ page }) => {
    await attachRealWorkerMock(page);
    await page.route('https://formsubmit.co/ajax/**', route => route.fulfill({ json: { success: true } }));

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.geekNookApp && window.GEEKNOOK_DATA?.stock?.getMeta().serverConnected);

    // Quick-buy the single remaining 80x40 Light Grey mat (20240408)
    await page.locator('#desk-mat-light .btn-card-details').click();
    const modal = page.locator('#quickViewModal');
    await expect(modal.locator('.qv-live-stock-badge')).toContainText('Осталось: 1 шт.');
    await modal.getByRole('button', { name: 'Купить в 1 клик' }).click();

    await page.locator('#quickBuyName').fill('Иван Иванов');
    await page.locator('#quickBuyPhone').fill('9990001122');
    await page.locator('#quickBuyConsentCheckbox').check();
    await page.locator('#quickBuyModal button[type="submit"]').click();

    await expect(page.locator('#successModal')).toHaveClass(/active/);

    // Bundle using 20240408 immediately disables itself after server commit
    await expect(page.locator('#bundlesGrid .bundle-card').nth(2).locator('.btn-bundle-buy')).toBeDisabled();

    // Even a fresh context / reload reading only from Worker sees 0 stock
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.geekNookApp && window.GEEKNOOK_DATA?.stock?.getMeta().serverConnected);
    await page.evaluate(() => window.geekNookApp.openQuickView('desk-mat-light'));
    await expect(modal.locator('.qv-live-stock-badge')).toContainText('Нет в наличии');
    await expect(modal.getByRole('button', { name: 'Добавить в корзину', exact: true })).toBeDisabled();

    // Open stock.html: verify zero secrets/hashes in HTML and strict server-side password check
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const loc = msg.location()?.url || '';
        const text = msg.text();
        if (/fonts\.googleapis\.com|fonts\.gstatic\.com|mc\.yandex\.ru|google-analytics\.com|googletagmanager\.com/i.test(loc)) return;
        if (text.includes('status of 401')) return; // expected negative auth check below
        errors.push(`${text}${loc ? ` (${loc})` : ''}`);
      }
    });
    page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

    await page.goto('/stock.html', { waitUntil: 'domcontentloaded' });
    const stockPageHtml = await page.content();
    expect(stockPageHtml).not.toContain(ADMIN_SECRET);
    expect(stockPageHtml).not.toContain('STOCK_ADMIN_HASH');

    await expect(page.locator('#stockAuthGate')).toBeVisible();
    await expect(page.locator('#stockProtectedContent')).toBeHidden();

    // Wrong password rejected by Worker with 401
    await page.locator('#stockPasswordInput').fill('wrong-password');
    await page.locator('#stockAuthSubmitBtn').click();
    await expect(page.locator('#stockAuthError')).toContainText('неверный пароль');
    await expect(page.locator('#stockProtectedContent')).toBeHidden();

    // Valid password opens real un-capped inventory from Worker (437 for 20240410, 0 & 3 spent for 20240408)
    await page.locator('#stockPasswordInput').fill(ADMIN_SECRET);
    await page.locator('#stockAuthSubmitBtn').click();
    await expect(page.locator('#stockProtectedContent')).toBeVisible();

    const row20240408 = page.locator('tr[data-code="20240408"]');
    await expect(row20240408).toContainText('3 шт.');
    await expect(row20240408).toContainText('0 шт.');
    await expect(row20240408).toContainText('Нет в наличии');
    await expect(page.locator('tr[data-code="20240410"]')).toContainText('437 шт.');
    await expect(page.locator('#movementsList')).toContainText('20240408: −1 шт.');

    // Admin +1 adjustment persists via Worker
    await row20240408.locator('button[data-adj="1"]').click();
    await expect(row20240408).toContainText('1 шт.');

    const exportedCsv = await page.evaluate(() => window.geekNookStockAdmin.exportCsv());
    expect(exportedCsv).toContain('20240408,Коврик для мыши / G4N-20240408 / Mouse pad GEEK NOOK 80*40CM Light Gray Felt,1,1499,3');

    const overflow1440 = await checkZeroOverflow(page);
    expect(overflow1440.hasOverflow).toBe(false);

    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await checkZeroOverflow(page);
    expect(overflow320.hasOverflow).toBe(false);

    await page.locator('#stockLogoutBtn').click();
    await expect(page.locator('#stockAuthGate')).toBeVisible();
    await expect(page.locator('#stockTableBody tr')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('Tilda checkout deducts Worker stock and opens successModal even when formsubmit.co hangs/fails', async ({ page }) => {
    await attachRealWorkerMock(page);
    await page.addInitScript(() => { window.GEEKNOOK_FORCE_TILDA = true; });
    await page.route('https://formsubmit.co/ajax/**', route => route.abort('timedout'));

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.geekNookApp && window.geekNookTilda && window.GEEKNOOK_DATA?.stock?.getMeta().serverConnected);

    // Inject mock hidden Tilda .t706 order form matching geeknook.ru
    await page.evaluate(() => {
      window.__tildaSubmittedCount = 0;
      window.tcart = { products: [] };
      const wrap = document.createElement('div');
      wrap.className = 't706';
      wrap.style.display = 'none';
      wrap.innerHTML = `
        <form name="form3929429901">
          <input name="Name" />
          <input name="Email" type="email" />
          <input name="Phone" />
          <input name="Код ПВЗ СДЭК" />
          <textarea name="Comment"></textarea>
          <input type="radio" name="paymentsystem" value="cash" />
          <button type="submit" class="t-submit">Checkout</button>
        </form>
      `;
      wrap.querySelector('form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        window.__tildaSubmittedCount++;
      });
      document.body.appendChild(wrap);

      window.geekNookApp.addToCart('gamepad-stand', 'Xbox / PS5', false);
      window.geekNookApp.openCheckout();
    });

    await page.locator('#checkoutForm input[name="name"]').fill('Сергей Козлов');
    await page.locator('#checkoutForm input[name="phone"]').fill('9991112233');
    await page.locator('#checkoutForm input[name="email"]').fill('test@example.com');
    await page.locator('#checkoutForm input[name="address"]').fill('[MSK2181] Москва');
    await page.locator('#checkoutConsentCheckbox').check();
    await page.locator('#checkoutForm button[type="submit"]').click();

    await expect(page.locator('#successModal')).toHaveClass(/active/, { timeout: 8000 });
    expect(await page.evaluate(() => window.__tildaSubmittedCount)).toBe(1);

    // Confirm Worker actually deducted 202404210 by 1 unit
    const workerRes = await page.evaluate(async (url) => {
      const r = await fetch(url + '/admin/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'gn-worker-secret-2026' },
        body: JSON.stringify({})
      });
      return r.json();
    }, WORKER_TEST_URL);
    const row = workerRes.items['202404210'];
    expect(row.orderSpent).toBe(1);
    expect(row.stock).toBe(row.initialStock - row.initialSpent - 1);
  });
});
