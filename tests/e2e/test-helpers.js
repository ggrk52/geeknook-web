// @ts-check

/**
 * Common test helper utilities for GeekNook E2E audit suite.
 */

/**
 * Configure network route aborting for third-party trackers to guarantee
 * offline determinism and prevent hanging network requests.
 * @param {import('@playwright/test').Page} page
 */
async function setupPageRoutes(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('geeknook_cookie_consent', 'true');
    } catch (e) {}
  });

  await page.route(/(mc\.yandex\.ru|google-analytics\.com|googletagmanager\.com|tilda\.ws)/i, route => {
    route.abort();
  });
}

/**
 * Evaluate zero-overflow criteria on the current page:
 * Checks whether document.documentElement.scrollWidth <= window.innerWidth.
 * If overflow is detected, collects diagnostic details of offending DOM elements.
 * @param {import('@playwright/test').Page} page
 */
async function checkZeroOverflow(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const clientWidth = doc.clientWidth;
    const innerWidth = window.innerWidth;

    const hasOverflow = scrollWidth > innerWidth;
    let offendingElements = [];

    if (hasOverflow) {
      const elements = Array.from(document.querySelectorAll('body *'));
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > innerWidth + 0.5) {
          const classStr = (typeof el.className === 'string' && el.className.trim()) 
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` 
            : '';
          const idStr = el.id ? `#${el.id}` : '';
          const selector = (idStr || classStr || el.tagName.toLowerCase());

          offendingElements.push({
            selector,
            tagName: el.tagName.toLowerCase(),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            innerWidth,
            overflowPx: Math.round(rect.right - innerWidth),
            htmlSnippet: el.outerHTML.slice(0, 100)
          });
        }
      }
      offendingElements.sort((a, b) => b.overflowPx - a.overflowPx);
      offendingElements = offendingElements.slice(0, 5);
    }

    return {
      scrollWidth,
      clientWidth,
      innerWidth,
      hasOverflow,
      offendingElements
    };
  });
}

module.exports = {
  setupPageRoutes,
  checkZeroOverflow,
};
