// @ts-check
const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');

/**
 * Suite: R4 - Console Errors & Unhandled Exception Monitoring
 * Asserts 0 console.error calls and 0 pageerror unhandled exceptions
 * across all pages and interactive user scenarios.
 */

const PAGES = [
  { name: 'index', path: '/index.html' },
  { name: 'b2b', path: '/b2b.html' },
  { name: 'podstavki', path: '/podstavki-pod-monitor.html' },
  { name: 'kabel-menedzhment', path: '/kabel-menedzhment.html' },
  { name: 'kovriki', path: '/kovriki-dlya-stola.html' },
  { name: 'journal', path: '/journal.html' },
  { name: 'legal', path: '/legal.html' },
];

/**
 * Attach listeners to capture console errors and page exceptions.
 * @param {import('@playwright/test').Page} page
 * @returns {{ errors: string[], exceptions: Error[] }}
 */
function attachErrorSniffer(page) {
  const errors = [];
  const exceptions = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out harmless aborted network requests caused by blocking external analytics
      const isExternalAbort = /net::ERR_FAILED|net::ERR_ABORTED|mc\.yandex\.ru|google-analytics\.com|googletagmanager\.com/i.test(text);
      if (!isExternalAbort) {
        errors.push(`[console.error] ${text} (location: ${msg.location().url}:${msg.location().lineNumber})`);
      }
    }
  });

  page.on('pageerror', exception => {
    exceptions.push(exception);
  });

  return { errors, exceptions };
}

test.describe('R4: Browser Console & Unhandled Exception Sniffer', () => {
  for (const pageInfo of PAGES) {
    test(`Zero console errors & unhandled exceptions on ${pageInfo.name} (${pageInfo.path})`, async ({ page }) => {
      const sniffer = attachErrorSniffer(page);
      await setupPageRoutes(page);

      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);

      const allErrors = [
        ...sniffer.errors,
        ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
      ];

      expect(allErrors, `Encountered ${allErrors.length} error(s) on ${pageInfo.path}:\n${allErrors.join('\n')}`).toEqual([]);
    });
  }

  test('Zero console errors during full interactive flows on index.html', async ({ page }) => {
    const sniffer = attachErrorSniffer(page);
    await setupPageRoutes(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // 1. Theme toggle
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(100);
      await themeBtn.click();
    }

    // 2. Open and close QuickView
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.openQuickView) {
        // @ts-ignore
        window.geekNookApp.openQuickView('focus-station-walnut');
      }
    });
    await page.waitForTimeout(300);

    // Switch size in QuickView
    const chip116 = page.locator('#quickViewModal .option-chip[data-val="116 см"]');
    if (await chip116.isVisible()) {
      await chip116.click();
      await page.waitForTimeout(150);
    }

    // Close QuickView
    const closeBtn = page.locator('#quickViewModal .btn-close-modal');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(150);
    }

    // 3. Toggle X-Ray
    const xrayBtn = page.locator('#focus-station-walnut .btn-card-xray').first();
    if (await xrayBtn.isVisible()) {
      await xrayBtn.click();
      await page.waitForTimeout(150);
      // Click node pins
      const pin = page.locator('#cardXray_focus-station-walnut .xray-node-pin').first();
      if (await pin.isVisible()) {
        await pin.click();
      }
      await xrayBtn.click(); // toggle back
    }

    // 4. Production 3D finish pill switch
    const finishPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-walnut"]');
    if (await finishPill.isVisible()) {
      await finishPill.click();
      await page.waitForTimeout(200);
    }

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];

    expect(allErrors, `Encountered console errors during interactive flows:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('Zero console errors during tab switching on legal.html', async ({ page }) => {
    const sniffer = attachErrorSniffer(page);
    await setupPageRoutes(page);
    await page.goto('/legal.html', { waitUntil: 'domcontentloaded' });

    // Switch through tabs
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof switchTab === 'function') {
        // @ts-ignore
        switchTab('privacy');
        // @ts-ignore
        switchTab('shipping');
        // @ts-ignore
        switchTab('requisites');
        // @ts-ignore
        switchTab('offer');
      }
    });
    await page.waitForTimeout(200);

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];

    expect(allErrors, `Encountered console errors during legal.html tab switching:\n${allErrors.join('\n')}`).toEqual([]);
  });
});
