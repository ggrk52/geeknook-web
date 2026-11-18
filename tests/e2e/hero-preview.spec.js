const { test, expect } = require('@playwright/test');
const { setupPageRoutes } = require('./test-helpers');
for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  test(`hero at ${viewport.width}px`, async ({ page }) => {
    await setupPageRoutes(page);
    await page.setViewportSize(viewport);
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(page.locator('.hero-actions a').first()).toBeVisible();
    await page.screenshot({ path: `/tmp/geeknook-hero-${viewport.width}.png` });
    const width = await page.evaluate(() => ({ screen: innerWidth, doc: document.documentElement.scrollWidth }));
    expect(width.doc).toBeLessThanOrEqual(width.screen);
  });
}
