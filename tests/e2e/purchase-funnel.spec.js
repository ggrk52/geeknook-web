const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');

test.beforeEach(async ({ page }) => {
  await setupPageRoutes(page);
  await page.addInitScript(() => { window.GEEKNOOK_FORCE_TILDA = true; });
});

test('Focus Station selection and checkout emit each funnel event once on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#focus-station-walnut .btn-card-details').click();
  const modal = page.locator('#quickViewModal');
  await expect(modal.locator('.qv-live-stock-badge')).toContainText('В наличии: 189 шт.');
  await expect(modal.locator('.qv-trust-badges')).toContainText('Гарантия 6 месяцев');
  await expect(modal.locator('.qv-order-terms')).toContainText('Осмотрите товар до оплаты');
  await expect(modal.locator('.qv-fit-guide')).toContainText('выбираются отдельно');
  await modal.getByRole('button', { name: 'Фото 2:', exact: false }).press('Enter');
  await expect(modal.getByRole('button', { name: 'Фото 2:', exact: false })).toHaveAttribute('aria-pressed', 'true');
  await modal.locator('.option-chip[data-val="116 см"]').click();
  await expect(modal.locator('.specs-table')).toBeVisible();
  await modal.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
  await page.locator('#siteHeader').getByRole('button', { name: 'Корзина', exact: true }).click();
  await page.getByRole('button', { name: 'Перейти к оформлению' }).click();
  await expect(page.locator('#checkoutItemsSummary')).toContainText('116 см');
  await expect(page.locator('#checkoutGrandTotalSummary')).toContainText('19 999');
  await expect(page.locator('#checkoutShippingVal')).toContainText('Бесплатно');
  const events = await page.evaluate(() => window.dataLayer.map(item => item.event));
  for (const name of ['VIEW_PRODUCT', 'ADD_TO_CART', 'BEGIN_CHECKOUT']) {
    expect(events.filter(event => event === name), name).toHaveLength(1);
  }
  expect(await page.locator('#checkoutEmail').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  expect(await page.locator('#checkoutModal').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
});

test('purchase tracking deduplicates acknowledgements and B2B analytics excludes contacts', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.geekNookAnalytics && window.geekNookApp);
  const result = await page.evaluate(() => {
    const analytics = window.geekNookAnalytics;
    analytics.trackOrderSubmit('GN-ANALYTICS-TEST', 1199, [{ id: 'desk-mat-light', price: 1199 }]);
    analytics.trackOrderSubmit('GN-ANALYTICS-TEST', 1199, [{ id: 'desk-mat-light', price: 1199 }]);
    document.dispatchEvent(new Event('tilda-cart-order-success'));
    analytics.trackB2bLead('PRIVATE COMPANY', 'private@example.com', '15');
    return window.dataLayer;
  });
  expect(result.filter(item => item.event === 'purchase')).toHaveLength(1);
  expect(result.filter(item => item.event === 'SUBMIT_ORDER')).toHaveLength(1);
  expect(result.find(item => item.event === 'purchase').ecommerce.purchase.actionField.shipping).toBe(0);
  const lead = result.find(item => item.event === 'B2B_LEAD');
  expect(lead.goalParams).toEqual({ workplaces: '15' });
  expect(JSON.stringify(lead)).not.toContain('private@example.com');
});


test('one remaining mat is shared between an individual item and a bundle', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.geekNookApp && window.GEEKNOOK_DATA);
  const cart = await page.evaluate(() => {
    const app = window.geekNookApp;
    app.addBundleToCart('bundle-minimalist-focus');
    app.addToCart('desk-mat-light', '80 × 40 см', false);
    app.addToCart('desk-mat-light', '100 × 50 см', false);
    return app.state.cart.map(({ id, option, price, quantity }) => ({ id, option, price, quantity }));
  });
  expect(cart).toHaveLength(2);
  expect(cart[1]).toMatchObject({ id: 'desk-mat-light', option: '100 × 50 см', price: 2499, quantity: 1 });
});

test('unavailable variant disables purchase and totals match Tilda for multiple units', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.geekNookApp && window.GEEKNOOK_DATA);
  await page.evaluate(() => {
    window.GEEKNOOK_DATA.getVariant('desk-mat-light', '80 × 40 см').stock = 0;
    window.geekNookApp.openQuickView('desk-mat-light');
  });
  const modal = page.locator('#quickViewModal');
  await expect(modal.locator('.qv-live-stock-badge')).toContainText('Нет в наличии');
  await expect(modal.getByRole('button', { name: 'Добавить в корзину', exact: true })).toBeDisabled();
  await modal.locator('.option-chip[data-val="100 × 50 см"]').click();
  await expect(modal.getByRole('button', { name: 'Добавить в корзину', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    window.tcart = { products: [] };
    for (let i = 0; i < 3; i++) window.geekNookApp.addToCart('desk-mat-light', '100 × 50 см', false);
    window.geekNookApp.closeModal('quickViewModal');
    window.geekNookApp.openCheckout();
  });
  await expect(page.locator('#checkoutGrandTotalSummary')).toContainText('5 997');
  expect(await page.evaluate(() => window.tcart.amount)).toBe(5997);
});
