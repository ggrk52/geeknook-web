// @ts-check
/**
 * scripts/run-challenger-stress.js
 * Adversarial Viewport & Layout Stress-Testing Harness for GeekNook
 * Evaluates 7 pages x 13 viewports + dynamic modal/drawer stress states.
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080';

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
  { name: 'min-320', width: 320, height: 640 },
  { name: 'edge-321', width: 321, height: 640 },
  { name: 'fold-340', width: 340, height: 640 },
  { name: 'android-360', width: 360, height: 740 },
  { name: 'iphone-375', width: 375, height: 667 },
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'phablet-414', width: 414, height: 896 },
  { name: 'landscape-480', width: 480, height: 800 },
  { name: 'boundary-640', width: 640, height: 960 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'widescreen-1440', width: 1440, height: 900 },
];

async function setupPage(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('geeknook_cookie_consent', 'true');
    } catch (e) {}
  });

  await page.route(/(mc\.yandex\.ru|google-analytics\.com|googletagmanager\.com|tilda\.ws)/i, route => {
    route.abort();
  });
}

async function evaluateOverflow(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const clientWidth = doc.clientWidth;
    const innerWidth = window.innerWidth;
    const hasOverflow = scrollWidth > innerWidth;

    let offendingElements = [];
    if (hasOverflow) {
      const all = Array.from(document.querySelectorAll('body *'));
      for (const el of all) {
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
            right: Math.round(rect.right * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            overflowPx: Math.round((rect.right - innerWidth) * 10) / 10,
            style: {
              boxSizing: style.boxSizing,
              overflow: style.overflow,
              overflowX: style.overflowX,
              maxWidth: style.maxWidth,
              minWidth: style.minWidth,
              width: style.width,
            },
            snippet: el.outerHTML.slice(0, 120),
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
      offendingElements,
    };
  });
}

async function runAdversarialStress() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await setupPage(page);

  const results = {
    timestamp: new Date().toISOString(),
    totalMatrixChecks: 0,
    matrixPassed: 0,
    matrixFailed: 0,
    matrixResults: [],
    modalStressChecks: 0,
    modalStressPassed: 0,
    modalStressFailed: 0,
    modalResults: [],
  };

  console.log('=== PHASE 1: STATIC VIEWPORT MATRIX (7 PAGES x 13 VIEWPORTS) ===');
  for (const p of PAGES) {
    for (const vp of VIEWPORTS) {
      results.totalMatrixChecks++;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100);

      const check = await evaluateOverflow(page);
      const passed = !check.hasOverflow;
      if (passed) {
        results.matrixPassed++;
      } else {
        results.matrixFailed++;
      }

      const item = {
        page: p.name,
        path: p.path,
        viewportName: vp.name,
        width: vp.width,
        height: vp.height,
        passed,
        scrollWidth: check.scrollWidth,
        innerWidth: check.innerWidth,
        offendingElements: check.offendingElements,
      };
      results.matrixResults.push(item);

      if (!passed) {
        console.error(`[FAIL] ${p.name} @ ${vp.width}px: scrollWidth=${check.scrollWidth} > innerWidth=${check.innerWidth}`);
        for (const o of check.offendingElements) {
          console.error(`       Offender: ${o.selector} right=${o.right}px (+${o.overflowPx}px)`);
        }
      }
    }
    console.log(`[PASS MATRIX] Completed all 13 viewports for ${p.name}`);
  }

  console.log('\n=== PHASE 2: DYNAMIC MODAL & DRAWER STRESS TESTING ===');
  const MODAL_VIEWPORTS = [320, 321, 360, 375];

  for (const w of MODAL_VIEWPORTS) {
    await page.setViewportSize({ width: w, height: 640 });

    // Test 1: Mobile Nav Drawer Open & Scroll on index.html
    results.modalStressChecks++;
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.openMobileNav) {
        // @ts-ignore
        window.geekNookApp.openMobileNav();
      }
    });
    await page.waitForTimeout(250);

    let navCheck = await evaluateOverflow(page);
    let navPassed = !navCheck.hasOverflow;

    // Scroll inside drawer
    await page.evaluate(() => {
      const body = document.querySelector('.mobile-nav-body');
      if (body) body.scrollTop = 300;
    });
    await page.waitForTimeout(100);
    let navScrollCheck = await evaluateOverflow(page);
    if (navScrollCheck.hasOverflow) navPassed = false;

    // Close drawer
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.closeMobileNav) {
        // @ts-ignore
        window.geekNookApp.closeMobileNav();
      }
    });
    await page.waitForTimeout(200);

    if (navPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'Mobile Navigation Drawer Open & Scroll',
      width: w,
      passed: navPassed,
      check: navCheck.hasOverflow ? navCheck : navScrollCheck,
    });
    console.log(`[MODAL] Mobile Nav Drawer @ ${w}px: ${navPassed ? 'PASS' : 'FAIL'}`);

    // Test 2: Slide-Over Cart Drawer Open (Empty)
    results.modalStressChecks++;
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.openCartDrawer) {
        // @ts-ignore
        window.geekNookApp.openCartDrawer();
      }
    });
    await page.waitForTimeout(250);
    let cartEmptyCheck = await evaluateOverflow(page);
    let cartEmptyPassed = !cartEmptyCheck.hasOverflow;
    if (cartEmptyPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'Cart Drawer Open (Empty)',
      width: w,
      passed: cartEmptyPassed,
      check: cartEmptyCheck,
    });
    console.log(`[MODAL] Cart Drawer Empty @ ${w}px: ${cartEmptyPassed ? 'PASS' : 'FAIL'}`);

    // Test 3: Cart Drawer with Items & Upsell & Promo Row
    results.modalStressChecks++;
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.addBundleToCart) {
        // @ts-ignore
        window.geekNookApp.addBundleToCart('bundle-developer-pro');
      }
    });
    await page.waitForTimeout(250);
    let cartFilledCheck = await evaluateOverflow(page);
    let cartFilledPassed = !cartFilledCheck.hasOverflow;

    // Scroll cart body
    await page.evaluate(() => {
      const scrollBody = document.querySelector('#cartScrollableBody');
      if (scrollBody) scrollBody.scrollTop = 200;
    });
    await page.waitForTimeout(100);
    let cartScrollCheck = await evaluateOverflow(page);
    if (cartScrollCheck.hasOverflow) cartFilledPassed = false;

    // Close cart drawer
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.closeCartDrawer) {
        // @ts-ignore
        window.geekNookApp.closeCartDrawer();
      }
    });
    await page.waitForTimeout(200);

    if (cartFilledPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'Cart Drawer with Bundle Items & Scroll',
      width: w,
      passed: cartFilledPassed,
      check: cartFilledCheck.hasOverflow ? cartFilledCheck : cartScrollCheck,
    });
    console.log(`[MODAL] Cart Drawer Filled @ ${w}px: ${cartFilledPassed ? 'PASS' : 'FAIL'}`);

    // Test 4: QuickView Modal Open (Walnut, Oak, Black)
    for (const prodId of ['focus-station-walnut', 'focus-station-oak', 'focus-station-black']) {
      results.modalStressChecks++;
      await page.evaluate((id) => {
        // @ts-ignore
        if (window.geekNookApp && window.geekNookApp.openQuickView) {
          // @ts-ignore
          window.geekNookApp.openQuickView(id);
        }
      }, prodId);
      await page.waitForTimeout(300);

      let qvCheck = await evaluateOverflow(page);
      let qvPassed = !qvCheck.hasOverflow;

      // Click size button 116cm if present
      await page.evaluate(() => {
        const qvModal = document.querySelector('#quickViewModal');
        if (qvModal) {
          const btn116 = Array.from(qvModal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('116'));
          if (btn116) btn116.click();
        }
      });
      await page.waitForTimeout(150);
      let qvSizeCheck = await evaluateOverflow(page);
      if (qvSizeCheck.hasOverflow) qvPassed = false;

      // Close modal
      await page.evaluate(() => {
        // @ts-ignore
        if (window.geekNookApp && window.geekNookApp.closeModal) {
          // @ts-ignore
          window.geekNookApp.closeModal('quickViewModal');
        }
      });
      await page.waitForTimeout(200);

      if (qvPassed) results.modalStressPassed++;
      else results.modalStressFailed++;
      results.modalResults.push({
        test: `QuickView Modal (${prodId}) & Size Toggle`,
        width: w,
        passed: qvPassed,
        check: qvCheck.hasOverflow ? qvCheck : qvSizeCheck,
      });
      console.log(`[MODAL] QuickView (${prodId}) @ ${w}px: ${qvPassed ? 'PASS' : 'FAIL'}`);
    }

    // Test 5: Configurator Modal (2D and 3D mode)
    results.modalStressChecks++;
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.openModal) {
        // @ts-ignore
        window.geekNookApp.openModal('configuratorModal');
      }
    });
    await page.waitForTimeout(300);

    let configCheck2d = await evaluateOverflow(page);
    let configPassed = !configCheck2d.hasOverflow;

    // Toggle 3D mode
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.setConfigViewMode) {
        // @ts-ignore
        window.geekNookApp.setConfigViewMode('3d');
      }
    });
    await page.waitForTimeout(300);
    let configCheck3d = await evaluateOverflow(page);
    if (configCheck3d.hasOverflow) configPassed = false;

    // Close modal
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.closeModal) {
        // @ts-ignore
        window.geekNookApp.closeModal('configuratorModal');
      }
    });
    await page.waitForTimeout(200);

    if (configPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'Configurator Modal (2D/3D Mode)',
      width: w,
      passed: configPassed,
      check: configCheck2d.hasOverflow ? configCheck2d : configCheck3d,
    });
    console.log(`[MODAL] Configurator Modal @ ${w}px: ${configPassed ? 'PASS' : 'FAIL'}`);

    // Test 6: Checkout Modal Form
    results.modalStressChecks++;
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.openCheckout) {
        // @ts-ignore
        window.geekNookApp.openCheckout();
      }
    });
    await page.waitForTimeout(300);
    let checkoutCheck = await evaluateOverflow(page);
    let checkoutPassed = !checkoutCheck.hasOverflow;

    // Close checkout
    await page.evaluate(() => {
      // @ts-ignore
      if (window.geekNookApp && window.geekNookApp.closeModal) {
        // @ts-ignore
        window.geekNookApp.closeModal('checkoutModal');
      }
    });
    await page.waitForTimeout(200);

    if (checkoutPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'Checkout Modal Form',
      width: w,
      passed: checkoutPassed,
      check: checkoutCheck,
    });
    console.log(`[MODAL] Checkout Modal @ ${w}px: ${checkoutPassed ? 'PASS' : 'FAIL'}`);

    // Test 7: CAD X-Ray Schematics on index.html cards
    results.modalStressChecks++;
    let xrayPassed = true;
    for (const cardId of ['focus-station-walnut', 'focus-station-oak', 'focus-station-black']) {
      await page.evaluate((id) => {
        // @ts-ignore
        if (window.geekNookApp && window.geekNookApp.toggleCardXRay) {
          // @ts-ignore
          window.geekNookApp.toggleCardXRay(id);
        }
      }, cardId);
      await page.waitForTimeout(150);
      let xrayCheck = await evaluateOverflow(page);
      if (xrayCheck.hasOverflow) {
        xrayPassed = false;
        console.error(`[FAIL] X-Ray on ${cardId} caused overflow at ${w}px!`);
      }
      // Toggle off
      await page.evaluate((id) => {
        // @ts-ignore
        if (window.geekNookApp && window.geekNookApp.toggleCardXRay) {
          // @ts-ignore
          window.geekNookApp.toggleCardXRay(id);
        }
      }, cardId);
      await page.waitForTimeout(100);
    }
    if (xrayPassed) results.modalStressPassed++;
    else results.modalStressFailed++;
    results.modalResults.push({
      test: 'CAD X-Ray Schematics Toggle on Product Cards',
      width: w,
      passed: xrayPassed,
      check: { hasOverflow: !xrayPassed },
    });
    console.log(`[MODAL] CAD X-Ray Schematics @ ${w}px: ${xrayPassed ? 'PASS' : 'FAIL'}`);
  }

  // Phase 3: Dedicated Category Grid Stress on podstavki-pod-monitor.html and b2b.html
  console.log('\n=== PHASE 3: SPECIALIZED LAYOUT STRESS (B2B & PODSTAVKI) ===');
  for (const w of [320, 321, 340, 360]) {
    await page.setViewportSize({ width: w, height: 640 });

    // Podstavki comparison table & knowledge grid
    await page.goto(`${BASE_URL}/podstavki-pod-monitor.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const podstavkiCheck = await evaluateOverflow(page);
    results.modalStressChecks++;
    if (!podstavkiCheck.hasOverflow) {
      results.modalStressPassed++;
      console.log(`[GRID] Podstavki comparison & knowledge grids @ ${w}px: PASS`);
    } else {
      results.modalStressFailed++;
      console.error(`[GRID FAIL] Podstavki @ ${w}px: scrollWidth=${podstavkiCheck.scrollWidth} > innerWidth=${podstavkiCheck.innerWidth}`);
    }
    results.modalResults.push({
      test: 'Podstavki Comparison & Knowledge Grid Overrides',
      width: w,
      passed: !podstavkiCheck.hasOverflow,
      check: podstavkiCheck,
    });

    // B2B navigation actions & form
    await page.goto(`${BASE_URL}/b2b.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const b2bCheck = await evaluateOverflow(page);
    results.modalStressChecks++;
    if (!b2bCheck.hasOverflow) {
      results.modalStressPassed++;
      console.log(`[GRID] B2B Navigation actions & form @ ${w}px: PASS`);
    } else {
      results.modalStressFailed++;
      console.error(`[GRID FAIL] B2B @ ${w}px: scrollWidth=${b2bCheck.scrollWidth} > innerWidth=${b2bCheck.innerWidth}`);
    }
    results.modalResults.push({
      test: 'B2B Navigation Actions & Form Overrides',
      width: w,
      passed: !b2bCheck.hasOverflow,
      check: b2bCheck,
    });
  }

  await browser.close();

  const outputPath = path.resolve(__dirname, 'challenger-stress-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nAdversarial stress testing complete. Output saved to ${outputPath}`);
  console.log(`Summary:
  - Static Matrix Checks: ${results.totalMatrixChecks} (Passed: ${results.matrixPassed}, Failed: ${results.matrixFailed})
  - Dynamic Modal/State Checks: ${results.modalStressChecks} (Passed: ${results.modalStressPassed}, Failed: ${results.modalStressFailed})
  - Total Checks: ${results.totalMatrixChecks + results.modalStressChecks}
  - Total Passed: ${results.matrixPassed + results.modalStressPassed}
  - Total Failed: ${results.matrixFailed + results.modalStressFailed}
  `);

  if (results.matrixFailed > 0 || results.modalStressFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialStress().catch(err => {
  console.error('Fatal stress test runner error:', err);
  process.exit(1);
});
