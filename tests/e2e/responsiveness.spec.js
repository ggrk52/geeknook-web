// @ts-check
const { test, expect } = require('@playwright/test');
const { setupPageRoutes, checkZeroOverflow } = require('./test-helpers');

/**
 * Suite: R1 - Responsiveness & Zero-Overflow Audit
 * Verifies that all 7 core pages maintain strict horizontal zero-overflow
 * (scrollWidth <= window.innerWidth) across viewports from 320px to 1440px.
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

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

test.describe('R1: Zero-Overflow Audit Across Viewports', () => {
  for (const pageInfo of PAGES) {
    test.describe(`Page: ${pageInfo.name} (${pageInfo.path})`, () => {
      for (const vp of VIEWPORTS) {
        test(`should have zero horizontal overflow at ${vp.width}px (${vp.name})`, async ({ page }) => {
          await setupPageRoutes(page);
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => {});

          const result = await checkZeroOverflow(page);

          if (result.hasOverflow) {
            const offendersList = result.offendingElements
              .map(o => `  - [${o.selector}] width=${o.width}px right=${o.right}px max=${o.innerWidth}px (+${o.overflowPx}px)`)
              .join('\n');
            const errorMsg = `Horizontal overflow detected on ${pageInfo.path} at viewport ${vp.width}px!\n` +
              `scrollWidth (${result.scrollWidth}px) > innerWidth (${result.innerWidth}px).\n` +
              `Top offending elements:\n${offendersList || '  (Root container or overflow-x style)'}`;
            expect(result.scrollWidth, errorMsg).toBeLessThanOrEqual(result.innerWidth);
          } else {
            expect(result.scrollWidth).toBeLessThanOrEqual(result.innerWidth);
          }
        });
      }
    });
  }

  test('Mobile navigation drawer does not introduce overflow on index.html at 320px', async ({ page }) => {
    await setupPageRoutes(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

    // Find and open mobile drawer if present
    const mobileMenuBtn = page.locator('.mobile-menu-btn, #mobileMenuToggle').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await page.waitForTimeout(300);

      // Verify drawer opened
      const drawer = page.locator('.mobile-nav-drawer, .mobile-nav-overlay').first();
      await expect(drawer).toBeVisible();

      // Check overflow while drawer is open
      const overflowResult = await checkZeroOverflow(page);
      expect(overflowResult.scrollWidth).toBeLessThanOrEqual(overflowResult.innerWidth);

      // Close drawer via close button
      const closeBtn = page.locator('.mobile-close-btn').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('Horizontal pill tabs on journal.html do not expand page width at 320px', async ({ page }) => {
    await setupPageRoutes(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/journal.html', { waitUntil: 'domcontentloaded' });

    // Check tabs container
    const filterContainer = page.locator('.category-pills, .tag-pills, .filter-pills, .journal-categories').first();
    if (await filterContainer.count() > 0) {
      const isVisible = await filterContainer.isVisible();
      if (isVisible) {
        // Verify container or child scrolling without widening document
        const overflow = await checkZeroOverflow(page);
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
      }
    }
  });
});
