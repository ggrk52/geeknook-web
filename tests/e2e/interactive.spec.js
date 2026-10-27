// @ts-check
const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');

/**
 * Suite: R2 - Interactive Components & Catalog Mechanics
 * Verifies wood species switching, dimensions/pricing calculation,
 * QuickView modal lifecycle, CAD X-Ray blueprints, and theme toggling.
 */

test.describe('R2: Interactive Components & Catalog Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageRoutes(page);
  });

  test.describe('1. Material Selection (Oak / Walnut / Ash)', () => {
    test('Catalog cards present authentic species with studio imagery', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      // Verify walnut card
      const walnutCard = page.locator('#focus-station-walnut');
      await expect(walnutCard).toBeVisible();
      await expect(walnutCard.locator('.product-card-title')).toContainText(/Walnut|Орех/i);

      // Verify oak card
      const oakCard = page.locator('#focus-station-oak');
      await expect(oakCard).toBeVisible();
      await expect(oakCard.locator('.product-card-title')).toContainText(/Oak|Дуб/i);

      // Verify black ash card
      const blackCard = page.locator('#focus-station-black');
      await expect(blackCard).toBeVisible();
      await expect(blackCard.locator('.product-card-title')).toContainText(/Black|Чёрн/i);
    });

    test('Production 3D Studio switches wood finishes dynamically', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      const finishPills = page.locator('#prod3dFinishPills .prod-pill');
      await expect(finishPills.first()).toBeVisible();

      // Click Walnut finish
      const walnutPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-walnut"]');
      await walnutPill.click();
      await expect(walnutPill).toHaveClass(/active/);

      // Click Black finish
      const blackPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-black"]');
      await blackPill.click();
      await expect(blackPill).toHaveClass(/active/);
      await expect(walnutPill).not.toHaveClass(/active/);

      // Click Oak finish
      const oakPill = page.locator('#prod3dFinishPills .prod-pill[data-finish="finish-oak"]');
      await oakPill.click();
      await expect(oakPill).toHaveClass(/active/);
      await expect(blackPill).not.toHaveClass(/active/);
    });

    test('Dedicated monitor stand category presents distinct wood species', async ({ page }) => {
      await page.goto('/podstavki-pod-monitor.html', { waitUntil: 'domcontentloaded' });

      await expect(page.locator('#walnut')).toBeVisible();
      await expect(page.locator('#oak')).toBeVisible();
      await expect(page.locator('#black')).toBeVisible();
    });
  });

  test.describe('2. Size Selection (85 cm / 116 cm) & Price Dynamics', () => {
    test('QuickView recalculates price, strikethrough, and dimensions on size switch', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      // Open QuickView for Walnut Focus Station
      await page.evaluate(() => {
        // @ts-ignore
        window.geekNookApp.openQuickView('focus-station-walnut');
      });

      const modal = page.locator('#quickViewModal');
      await expect(modal).toHaveClass(/active/);

      // Verify option chips for sizes
      const chip85 = modal.locator('.option-chip[data-val="85 см"]');
      const chip116 = modal.locator('.option-chip[data-val="116 см"]');
      await expect(chip85).toBeVisible();
      await expect(chip116).toBeVisible();

      // Default is 85 cm
      await expect(chip85).toHaveClass(/active/);
      const initialPrice = await modal.locator('#qvPriceCurrent').innerText();
      const initialDims = await modal.locator('.qv-verified-dimensions').innerText();
      expect(initialDims).toContain('85');

      // Click 116 cm
      await chip116.click();
      await expect(chip116).toHaveClass(/active/);
      await expect(chip85).not.toHaveClass(/active/);

      // Price and dimensions should dynamically update
      const updatedPrice = await modal.locator('#qvPriceCurrent').innerText();
      const updatedDims = await modal.locator('.qv-verified-dimensions').innerText();
      expect(updatedDims).toContain('116');
      expect(updatedPrice).not.toBe(initialPrice);

      // Strikethrough price and discount badge must be visible
      await expect(modal.locator('#qvPriceOld')).toBeVisible();
      await expect(modal.locator('#qvDiscountBadge')).toContainText('-20%');

      // Click back to 85 cm
      await chip85.click();
      await expect(chip85).toHaveClass(/active/);
      const revertedPrice = await modal.locator('#qvPriceCurrent').innerText();
      const revertedDims = await modal.locator('.qv-verified-dimensions').innerText();
      expect(revertedPrice).toBe(initialPrice);
      expect(revertedDims).toContain('85');
    });

    test('Podstavki page toggles 85 cm and 116 cm with price update', async ({ page }) => {
      await page.goto('/podstavki-pod-monitor.html', { waitUntil: 'domcontentloaded' });

      const walnutCard = page.locator('#walnut');
      await expect(walnutCard).toBeVisible();

      const btn85 = walnutCard.locator('.size-btn').filter({ hasText: /85/ }).first();
      const btn116 = walnutCard.locator('.size-btn').filter({ hasText: /116/ }).first();

      await expect(btn85).toHaveClass(/active/);
      const basePrice = await walnutCard.locator('#walnut-price').innerText();

      // Switch to 116 cm
      await btn116.click();
      await expect(btn116).toHaveClass(/active/);
      const largerPrice = await walnutCard.locator('#walnut-price').innerText();
      expect(largerPrice).not.toBe(basePrice);

      // Switch back to 85 cm
      await btn85.click();
      await expect(btn85).toHaveClass(/active/);
      const restoredPrice = await walnutCard.locator('#walnut-price').innerText();
      expect(restoredPrice).toBe(basePrice);
    });
  });

  test.describe('3. QuickView Modal Lifecycle & Focus Trapping', () => {
    test('Opens with scroll-lock and closes via close button', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      const modal = page.locator('#quickViewModal');

      // Open via card details button
      const cardBtn = page.locator('#focus-station-walnut .btn-card-details').first();
      await cardBtn.scrollIntoViewIfNeeded();
      await cardBtn.click();

      await expect(modal).toHaveClass(/active/);
      await expect(modal).toBeVisible();

      // Body must have scroll lock
      const bodyHasClass = await page.evaluate(() => document.body.classList.contains('has-modal-open'));
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyHasClass).toBe(true);
      expect(bodyOverflow).toBe('hidden');

      // Close via close button
      const closeBtn = modal.locator('.btn-close-modal');
      await closeBtn.click();

      await expect(modal).not.toHaveClass(/active/);
      const bodyUnlocked = await page.evaluate(() => document.body.style.overflow);
      expect(bodyUnlocked).not.toBe('hidden');
    });

    test('Closes cleanly via Escape key', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      await page.evaluate(() => {
        // @ts-ignore
        window.geekNookApp.openQuickView('focus-station-oak');
      });

      const modal = page.locator('#quickViewModal');
      await expect(modal).toHaveClass(/active/);

      // Press Escape
      await page.keyboard.press('Escape');

      await expect(modal).not.toHaveClass(/active/);
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).not.toBe('hidden');
    });

    test('Closes via backdrop click outside modal card', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      await page.evaluate(() => {
        // @ts-ignore
        window.geekNookApp.openQuickView('focus-station-black');
      });

      const modal = page.locator('#quickViewModal');
      await expect(modal).toHaveClass(/active/);

      // Click outside modal content (top-left corner of backdrop)
      await modal.click({ position: { x: 10, y: 10 } });

      await expect(modal).not.toHaveClass(/active/);
    });
  });

  test.describe('4. X-Ray ISO-9241 Schematic CAD Viewer', () => {
    test('Toggles blueprint view, exposes node pins, and reverts to photo', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      const card = page.locator('#focus-station-walnut');
      const xrayBtn = card.locator('.btn-card-xray');
      const blueprint = card.locator('#cardXray_focus-station-walnut');

      await expect(xrayBtn).toBeVisible();
      await expect(blueprint).not.toHaveClass(/active/);

      // Toggle X-Ray ON
      await xrayBtn.click();
      await expect(blueprint).toHaveClass(/active/);
      await expect(xrayBtn).toHaveClass(/active/);
      await expect(xrayBtn.locator('span')).toHaveText('Фото');

      // Verify CAD schematic header and SVG
      await expect(blueprint.locator('.xray-header-tag')).toHaveText('ISO-9241 // CAD SCHEMATIC');
      const schematicSvg = blueprint.locator('svg.xray-schematic-svg');
      await expect(schematicSvg).toBeVisible();

      // Inspect interactive node pins (1, 2, 3, 4)
      const pins = blueprint.locator('.xray-node-pin');
      await expect(pins).toHaveCount(4);

      // Click pin 1 and verify toast trigger
      await pins.nth(0).click();
      const toast = page.locator('#geeknookToast, .toast-notification, .toast');
      if (await toast.count() > 0) {
        await expect(toast.first()).toBeVisible();
      }

      // Click pin 2, 3, 4 without errors
      await pins.nth(1).click();
      await pins.nth(2).click();
      await pins.nth(3).click();

      // Toggle X-Ray OFF (back to photo)
      await xrayBtn.click();
      await expect(blueprint).not.toHaveClass(/active/);
      await expect(xrayBtn).not.toHaveClass(/active/);
      await expect(xrayBtn.locator('span')).toHaveText('X-Ray');
    });
  });

  test.describe('5. Theme Switcher (Dark / Light Mode)', () => {
    test('Toggles data-theme attribute via header button and keyboard shortcut', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      const themeBtn = page.locator('#themeToggleBtn');
      await expect(themeBtn).toBeVisible();

      const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark');
      const targetTheme = initialTheme === 'dark' ? 'light' : 'dark';

      // Toggle via button
      await themeBtn.click();
      const themeAfterClick = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(themeAfterClick).toBe(targetTheme);

      // Toggle back via keyboard shortcut 'T'
      await page.keyboard.press('KeyT');
      const themeAfterKey = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(themeAfterKey).toBe(initialTheme);
    });

    test('Persists theme choice to localStorage across reload', async ({ page }) => {
      await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

      // Set to light theme explicitly
      await page.evaluate(() => {
        // @ts-ignore
        window.geekNookApp.themeManager.applyTheme('light', false, true);
      });

      const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(currentTheme).toBe('light');

      // Reload page and verify theme persisted
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reloadedTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(reloadedTheme).toBe('light');
    });
  });
});
