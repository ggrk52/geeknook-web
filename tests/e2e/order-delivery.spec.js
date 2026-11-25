const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');

test.beforeEach(async ({ page }) => {
  await setupPageRoutes(page);
});

test('order delivery requires an acknowledgement and records metadata only after success', async ({ page }) => {
  let succeed = false;
  await page.route('https://formsubmit.co/ajax/**', route => route.fulfill({
    status: succeed ? 200 : 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: succeed })
  }));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  const submit = () => page.evaluate(async () => {
    try {
      await window.geekNookApp.dispatchUnifiedOrder({ type: 'quick_buy', order_number: 'TEST-123', name: 'Test', phone: '+79990000000', product_id: 'focus-station-oak', product_title: 'Test', price: 100 });
      return true;
    } catch (_) { return false; }
  });
  expect(await submit()).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('geeknook_orders_history'))).toBeNull();
  succeed = true;
  expect(await submit()).toBe(true);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('geeknook_orders_history')));
  expect(history[0].order_number).toBe('TEST-123');
  expect(history[0]).not.toHaveProperty('phone');
});

test('B2B form retains the entered data when the API is unavailable', async ({ page }) => {
  await page.route('**/api/b2b-lead.php', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/b2b.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#b2bLandingCompany').fill('Тестовая компания');
  await page.locator('#b2bLandingEmail').fill('test@example.com');
  await page.locator('#b2bLandingContact').fill('Тест');
  await page.locator('#b2bLandingPhone').fill('+79990000000');
  await page.locator('#b2bLandingLeadForm').evaluate(form => form.requestSubmit());
  await expect(page.getByText('Не удалось отправить заявку.', { exact: false })).toBeVisible();
  await expect(page.locator('#b2bLandingCompany')).toHaveValue('Тестовая компания');
  expect(await page.evaluate(() => localStorage.getItem('geeknook_b2b_leads'))).toBeNull();
});

test('Tilda B2B bridge submits once and waits for confirmation', async ({ page }) => {
  await page.addInitScript(() => { window.GEEKNOOK_FORCE_TILDA = true; });
  await page.goto('/b2b.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const native = document.createElement('form');
    native.id = 'form4749392701';
    native.innerHTML = '<input name="Email"><input name="Name"><input name="Phone"><textarea name="Comments"></textarea><div class="js-successbox" style="display:none"></div><button type="submit">Send</button>';
    native.addEventListener('submit', e => { e.preventDefault(); window.testTildaSubmissions = (window.testTildaSubmissions || 0) + 1; setTimeout(() => { native.querySelector('.js-successbox').style.display = 'block'; }, 100); });
    document.body.append(native);
  });
  await page.locator('#b2bLandingCompany').fill('Тестовая компания');
  await page.locator('#b2bLandingContact').fill('Тест');
  await page.locator('#b2bLandingEmail').fill('test@example.com');
  await page.locator('#b2bLandingPhone').fill('+79990000000');
  await page.locator('#b2bLandingLeadForm').evaluate(form => form.requestSubmit());
  await expect(page.getByText('Заявка отправлена. Мы свяжемся с вами.')).toBeVisible();
  expect(await page.evaluate(() => window.testTildaSubmissions)).toBe(1);
  expect(await page.locator('#form4749392701 [name="Comments"]').inputValue()).toContain('Тестовая компания');
});

test('Tilda quick buy does not report success when order delivery fails', async ({ page }) => {
  await page.addInitScript(() => { window.GEEKNOOK_FORCE_TILDA = true; });
  await page.route('https://formsubmit.co/ajax/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false}' }));
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.geekNookApp.openQuickBuy('focus-station-oak'));
  await page.locator('#quickBuyName').fill('Тест');
  await page.locator('#quickBuyPhone').fill('+79990000000');
  await page.locator('#quickBuyConsentCheckbox').check();
  await page.locator('#quickBuyModal button[type="submit"]').click();
  await expect(page.getByText('Не удалось подтвердить отправку.', { exact: false })).toBeVisible();
  await expect(page.locator('#successModal')).not.toHaveClass(/active/);
  await expect(page.locator('#quickBuyName')).toHaveValue('Тест');
});

test('main catalog checkout sends mat details to Tilda and the email fallback', async ({ page }) => {
  const fallbackOrders = [];
  await page.route('https://formsubmit.co/ajax/**', async route => {
    fallbackOrders.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true } });
  });
  await page.addInitScript(() => {
    window.GEEKNOOK_FORCE_TILDA = true;
    window.tcart = { products: [] };
  });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const nativeForm = document.createElement('form');
    nativeForm.name = 'form3929429901';
    nativeForm.hidden = true;
    nativeForm.innerHTML = '<input name="Name"><input name="Email" type="email"><input name="Phone"><textarea name="Comment"></textarea><input name="Код ПВЗ СДЭК" value="MSK2181"><button type="submit">Send</button>';
    nativeForm.addEventListener('submit', event => {
      event.preventDefault();
      window.testTildaOrders ??= [];
      window.testTildaOrders.push(Object.fromEntries(new FormData(nativeForm)));
      nativeForm.dispatchEvent(new Event('tildaform:aftersuccess'));
    });
    document.body.append(nativeForm);
  });

  await page.locator('#desk-mat-light .btn-card-details').click();
  await page.locator('#quickViewModal').getByRole('button', { name: 'Добавить в корзину' }).click();
  await page.locator('#siteHeader').getByRole('button', { name: 'Корзина', exact: true }).click();
  await page.getByRole('button', { name: 'Перейти к оформлению' }).click();
  await expect(page.locator('#checkoutItemsSummary')).toContainText('Desk Mat Light');
  await page.locator('#checkoutName').fill('Тест Тестов');
  await page.locator('#checkoutEmail').fill('test@example.com');
  await page.locator('#checkoutPhone').fill('+79990000000');
  await expect(page.locator('#checkoutGrandTotalSummary')).toContainText('1 199');
  await expect(page.locator('#checkoutShippingVal')).toContainText('Бесплатно');
  await page.locator('#checkoutAddressInput').fill('MSK2499 ТЕСТ НЕ ОТПРАВЛЯТЬ');
  await page.locator('#checkoutConsentCheckbox').check();
  await page.locator('#checkoutForm').getByRole('button', { name: 'Подтвердить заказ' }).click();

  await expect(page.locator('#successModal')).toHaveClass(/active/);
  const tildaOrders = await page.evaluate(() => window.testTildaOrders);
  expect(tildaOrders).toHaveLength(1);
  expect(tildaOrders[0]).toMatchObject({ Email: 'test@example.com', 'Код ПВЗ СДЭК': 'MSK2499' });
  expect(tildaOrders[0]['Пункт выдачи полностью']).toBe('MSK2499 ТЕСТ НЕ ОТПРАВЛЯТЬ');
  expect(tildaOrders[0]['Стоимость доставки']).toBe('0 ₽ (бесплатно)');
  expect(JSON.parse(tildaOrders[0].tildapayment).amount).toBe(1199);
  expect(JSON.parse(tildaOrders[0].tildapayment).products[0]).toMatchObject({
    name: expect.stringContaining('Desk Mat Light'), quantity: 1
  });
  expect(fallbackOrders).toHaveLength(1);
  expect(fallbackOrders[0]['Товары']).toContain('Desk Mat Light');
  const orderNumber = fallbackOrders[0]['Заказ'].match(/GN-\d+/)?.[0];
  expect(orderNumber).toBeTruthy();
  expect(tildaOrders[0]['Номер заказа сайта']).toBe(orderNumber);
  expect(fallbackOrders[0]['Сумма платежа']).toBe('1199 RUB');
  expect(fallbackOrders[0]['Код_ПВЗ_СДЭК']).toContain('ТЕСТ НЕ ОТПРАВЛЯТЬ');
  await expect(page.locator('#successOrderDetails')).toContainText(orderNumber);
});

test('accepted Tilda order survives a reload while waiting for stock without sending the order twice', async ({ page }) => {
  let confirmed = false;
  let backupCount = 0;
  let receiptLookups = 0;
  await page.route('https://formsubmit.co/ajax/**', route => {
    backupCount++;
    return route.fulfill({ json: { success: true } });
  });
  await page.route(/geeknook-stock.*workers\.dev/, route => {
    const body = route.request().postDataJSON();
    if (body?.action !== 'commit') return route.fulfill({ json: { ok: true, items: {} } });
    if (!body.items) receiptLookups++;
    return confirmed
      ? route.fulfill({ json: { ok: true, alreadyCommitted: true, items: {} } })
      : route.fulfill({ status: 409, json: { ok: false, pending: true } });
  });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  const submit = () => page.evaluate(async () => {
    const receipt = await window.geekNookApp.dispatchUnifiedOrder({
      type: 'quick_buy', order_number: 'GN-1C-TEST12345', product_id: 'focus-station-oak',
      product_option: '85 см', price: 15999, tildaDispatched: true
    });
    window.geekNookApp.displayStockStatus(receipt);
    return receipt.stockStatus;
  });
  expect(await submit()).toBe('pending');
  expect(await submit()).toBe('pending');
  await expect(page.locator('#successModal h2')).toHaveText('Заказ получен');
  confirmed = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.geekNookApp.openCartDrawer());
  await expect(page.locator('#cartOrderReceipts')).toContainText('GN-1C-TEST12345 · Наличие подтверждено');
  expect(backupCount).toBe(1);
  expect(receiptLookups).toBe(1);
});
