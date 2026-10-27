// @ts-check
const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');

/**
 * Suite: Adversarial Interactive Component Stress-Testing
 * Designed by Challenger 2 to aggressively stress-test interactive mechanisms:
 * 1. Rapid material switching (finish pills, QuickView galleries)
 * 2. Rapid size toggling (85 cm <-> 116 cm) with strict dynamic price integrity
 * 3. Rapid QuickView modal lifecycle (Escape, backdrop, close button, deep links)
 * 4. Rapid X-Ray CAD schematic toggling and pin clicking
 * 5. Rapid theme toggling (button, key 'T')
 * Asserts 0 console errors and 0 unhandled exceptions throughout.
 */

/**
 * Attach listeners to capture console errors and page exceptions.
 * @param {import('@playwright/test').Page} page
 */
function attachStrictErrorSniffer(page) {
  const errors = [];
  const exceptions = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
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

test.describe('Adversarial Interactive Stress-Testing (Challenger 2)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageRoutes(page);
  });

  test('Stress 1: Rapid-fire wood finishes & material switching (25 cycles / 75 rapid switches)', async ({ page }) => {
    test.setTimeout(60000);
    const sniffer = attachStrictErrorSniffer(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Scroll to 3D studio section to ensure it's in viewport
    const studioSection = page.locator('#workbenchStudio');
    if (await studioSection.count() > 0) {
      await studioSection.scrollIntoViewIfNeeded();
    }

    const oakPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-oak"]');
    const walnutPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-walnut"]');
    const blackPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-black"]');

    await expect(oakPill).toBeVisible({ timeout: 10000 });
    await expect(walnutPill).toBeVisible();
    await expect(blackPill).toBeVisible();

    // Rapid-fire switching across Oak -> Walnut -> Black -> Oak 25 times
    for (let i = 0; i < 25; i++) {
      await walnutPill.click();
      await blackPill.click();
      await oakPill.click();
    }

    // After 75 rapid clicks, verify final state integrity
    await expect(oakPill).toHaveClass(/active/);
    await expect(walnutPill).not.toHaveClass(/active/);
    await expect(blackPill).not.toHaveClass(/active/);

    // Verify 3D canvas is still present and valid
    const canvas = page.locator('#production3dCanvas');
    await expect(canvas).toBeVisible();

    // Verify 0 uncaught errors or console errors
    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];
    expect(allErrors, `Encountered errors during rapid material switching:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('Stress 2: Rapid-fire size toggling (85 cm <-> 116 cm) with dynamic price integrity', async ({ page }) => {
    test.setTimeout(60000);
    const sniffer = attachStrictErrorSniffer(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Open QuickView for Walnut Focus Station
    await page.evaluate(() => {
      // @ts-ignore
      window.geekNookApp.openQuickView('focus-station-walnut');
    });

    const modal = page.locator('#quickViewModal');
    await expect(modal).toHaveClass(/active/);

    const chip85 = modal.locator('.option-chip[data-val="85 см"]');
    const chip116 = modal.locator('.option-chip[data-val="116 см"]');
    const curPrice = modal.locator('#qvPriceCurrent');
    const oldPrice = modal.locator('#qvPriceOld');
    const discBadge = modal.locator('#qvDiscountBadge');
    const dimsEl = modal.locator('.qv-verified-dimensions');
    const artEl = modal.locator('.qv-verified-article');

    await expect(chip85).toBeVisible();
    await expect(chip116).toBeVisible();

    const norm = str => (str || '').replace(/[\s\u00A0\u202F]+/g, ' ').trim();

    // Rapid-fire toggle 30 roundtrips (60 clicks)
    for (let i = 0; i < 30; i++) {
      // Toggle to 116 cm
      await chip116.click();

      const price116 = await curPrice.innerText();
      const old116 = await oldPrice.innerText();
      const disc116 = await discBadge.innerText();
      const dims116 = await dimsEl.innerText();
      const art116 = await artEl.innerText();

      expect(price116).not.toContain('NaN');
      expect(price116).not.toContain('undefined');
      expect(norm(price116)).toContain('24 999');
      expect(price116).toContain('₽');

      expect(old116).not.toContain('NaN');
      expect(norm(old116)).toContain('29 000');
      expect(old116).toContain('₽');

      expect(disc116).not.toContain('NaN');
      expect(norm(disc116)).toContain('19 999');

      expect(dims116).toContain('116');
      expect(art116).toBe('202404202');

      // Toggle back to 85 cm
      await chip85.click();

      const price85 = await curPrice.innerText();
      const old85 = await oldPrice.innerText();
      const disc85 = await discBadge.innerText();
      const dims85 = await dimsEl.innerText();
      const art85 = await artEl.innerText();

      expect(price85).not.toContain('NaN');
      expect(price85).not.toContain('undefined');
      expect(norm(price85)).toContain('19 999');
      expect(price85).toContain('₽');

      expect(old85).not.toContain('NaN');
      expect(norm(old85)).toContain('25 000');
      expect(old85).toContain('₽');

      expect(disc85).not.toContain('NaN');
      expect(norm(disc85)).toContain('15 999');

      expect(dims85).toContain('85');
      expect(art85).toBe('202404201');
    }

    // Now test category page podstavki-pod-monitor.html size toggling
    await page.goto('/podstavki-pod-monitor.html', { waitUntil: 'domcontentloaded' });
    const models = ['walnut', 'oak', 'black'];

    for (const model of models) {
      const card = page.locator(`#${model}`);
      const btn85 = card.locator('.size-btn').filter({ hasText: /85/ }).first();
      const btn116 = card.locator('.size-btn').filter({ hasText: /116/ }).first();
      const priceEl = card.locator(`#${model}-price`);
      const oldPriceEl = card.locator(`#${model}-oldprice`);
      const dimEl = card.locator(`#${model}-dim`);

      // 20 rapid switches per card
      for (let j = 0; j < 20; j++) {
        await btn116.click();
        const p116 = await priceEl.innerText();
        expect(p116).not.toContain('NaN');
        expect(p116).not.toContain('undefined');
        expect(p116).toContain('₽');
        expect(await dimEl.innerText()).toContain('116.0');

        await btn85.click();
        const p85 = await priceEl.innerText();
        expect(p85).not.toContain('NaN');
        expect(p85).not.toContain('undefined');
        expect(p85).toContain('₽');
        expect(await dimEl.innerText()).toContain('85.0');
      }
    }

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];
    expect(allErrors, `Encountered errors during rapid size toggling:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('Stress 3: Rapid-fire QuickView modal open & close lifecycle (Escape, backdrop, button, deep links)', async ({ page }) => {
    test.setTimeout(60000);
    const sniffer = attachStrictErrorSniffer(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const modal = page.locator('#quickViewModal');
    const closeBtn = modal.locator('.btn-close-modal');

    const products = ['focus-station-walnut', 'focus-station-oak', 'focus-station-black'];

    // 24 rapid cycles alternating closing mechanisms
    for (let cycle = 0; cycle < 24; cycle++) {
      const prodId = products[cycle % products.length];

      // Open via JS API or card click
      await page.evaluate((id) => {
        // @ts-ignore
        window.geekNookApp.openQuickView(id);
      }, prodId);

      await expect(modal).toHaveClass(/active/);
      await page.waitForTimeout(80);

      // Verify scroll lock engaged
      const bodyHasModal = await page.evaluate(() => document.body.classList.contains('has-modal-open'));
      expect(bodyHasModal).toBe(true);

      const closeMethod = cycle % 3;
      if (closeMethod === 0) {
        // Close via Close button
        await closeBtn.click();
      } else if (closeMethod === 1) {
        // Close via Escape key
        await page.keyboard.press('Escape');
      } else if (closeMethod === 2) {
        // Close via Backdrop click outside modal content
        await modal.click({ position: { x: 8, y: 8 } });
      }

      await expect(modal).not.toHaveClass(/active/);
      await page.waitForTimeout(80);

      // Verify scroll lock cleanly disengaged
      const bodyHasModalAfter = await page.evaluate(() => document.body.classList.contains('has-modal-open'));
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyHasModalAfter).toBe(false);
      expect(bodyOverflow).not.toBe('hidden');
    }

    // Stress deep link hash switching
    for (const prodId of products) {
      await page.evaluate((id) => {
        window.location.hash = `#${id}`;
      }, prodId);
      await page.waitForTimeout(300); // 250ms debounce in modern-app.js
      await expect(modal).toHaveClass(/active/);
      await page.keyboard.press('Escape');
      await expect(modal).not.toHaveClass(/active/);
    }

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];
    expect(allErrors, `Encountered errors during rapid QuickView lifecycle:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('Stress 4: Rapid-fire X-Ray CAD schematic toggling & node pins clicking', async ({ page }) => {
    test.setTimeout(60000);
    const sniffer = attachStrictErrorSniffer(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const card = page.locator('#focus-station-walnut');
    await card.scrollIntoViewIfNeeded();

    const xrayBtn = card.locator('.btn-card-xray');
    const blueprint = card.locator('#cardXray_focus-station-walnut');
    await expect(xrayBtn).toBeVisible();

    // 1. Rapid toggle X-Ray on/off 20 times
    for (let i = 0; i < 20; i++) {
      await xrayBtn.click();
      await expect(blueprint).toHaveClass(/active/);
      await expect(xrayBtn.locator('span')).toHaveText('Фото');

      await xrayBtn.click();
      await expect(blueprint).not.toHaveClass(/active/);
      await expect(xrayBtn.locator('span')).toHaveText('X-Ray');
    }

    // 2. Turn X-Ray ON and spam click pins 1-4
    await xrayBtn.click();
    await expect(blueprint).toHaveClass(/active/);

    const pins = blueprint.locator('.xray-node-pin');
    await expect(pins).toHaveCount(4);

    // Click pins 1-4 across 15 cycles (60 pin clicks in rapid succession)
    for (let cycle = 0; cycle < 15; cycle++) {
      await pins.nth(0).click();
      await pins.nth(1).click();
      await pins.nth(2).click();
      await pins.nth(3).click();
    }

    // Verify SVG structure and elements remain intact
    const svgSchematic = blueprint.locator('svg.xray-schematic-svg');
    await expect(svgSchematic).toBeVisible();
    await expect(pins).toHaveCount(4);

    // Turn X-Ray back OFF
    await xrayBtn.click();
    await expect(blueprint).not.toHaveClass(/active/);
    await expect(xrayBtn.locator('span')).toHaveText('X-Ray');

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];
    expect(allErrors, `Encountered errors during X-Ray schematic stress-test:\n${allErrors.join('\n')}`).toEqual([]);
  });

  test('Stress 5: Rapid-fire theme toggling (Button & keyboard shortcut KeyT)', async ({ page }) => {
    test.setTimeout(60000);
    const sniffer = attachStrictErrorSniffer(page);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    const themeBtn = page.locator('#themeToggleBtn');
    await expect(themeBtn).toBeVisible();

    // 1. Rapid-fire click button 40 times
    for (let i = 0; i < 40; i++) {
      await themeBtn.click();
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(['light', 'dark']).toContain(theme);
    }

    // 2. Rapid-fire press key 'T' 40 times
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('KeyT');
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(['light', 'dark']).toContain(theme);
    }

    // 3. Interleaved button and key presses
    for (let i = 0; i < 15; i++) {
      await themeBtn.click();
      await page.keyboard.press('KeyT');
    }

    // Verify theme state consistency with localStorage
    const domTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const storedTheme = await page.evaluate(() => localStorage.getItem('geeknook_theme_manual') || localStorage.getItem('geeknook_theme'));
    expect(['light', 'dark']).toContain(domTheme);
    expect(storedTheme).toBe(domTheme);

    const allErrors = [
      ...sniffer.errors,
      ...sniffer.exceptions.map(e => `[pageerror] ${e.message}\n${e.stack}`),
    ];
    expect(allErrors, `Encountered errors during theme toggling stress-test:\n${allErrors.join('\n')}`).toEqual([]);
  });
});
