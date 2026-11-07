const { chromium, devices } = require('playwright');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROTO_URL = 'file://' + path.resolve('prototype-3d.html');

async function test3DPrototype() {
  console.log('--- TESTING 3D WEBGL PROTOTYPE (prototype-3d.html) ---');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  // 1. Desktop Test (1440x900)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto(PROTO_URL, { waitUntil: 'load' });
  await page.waitForTimeout(1000); // Allow WebGL and procedural textures to render

  const status = await page.evaluate(() => {
    return {
      hasCanvas: !!document.getElementById('webgl-canvas'),
      hasThree: typeof window.THREE !== 'undefined',
      activeWood: document.querySelector('.wood-tab-btn.active')?.dataset.wood,
      title: document.querySelector('.model-title')?.textContent.trim()
    };
  });
  console.log('Desktop 3D Status:', status);
  console.log('Console Errors:', consoleErrors.length);

  // Take screenshot: Default Assembled State (Walnut)
  await page.screenshot({ path: path.resolve('test_3d_assembled_walnut.png') });
  console.log('✓ Captured test_3d_assembled_walnut.png');

  // Trigger Explode
  await page.evaluate(() => {
    const btn = document.getElementById('btnToggleExplode');
    if (btn) btn.click();
  });
  await page.waitForTimeout(1200); // Wait for smooth explode interpolation

  // Take screenshot: Exploded View
  await page.screenshot({ path: path.resolve('test_3d_exploded.png') });
  console.log('✓ Captured test_3d_exploded.png');

  // Switch wood to Oak
  await page.evaluate(() => {
    const oakBtn = document.querySelector('[data-wood="oak"]');
    if (oakBtn) oakBtn.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.resolve('test_3d_exploded_oak.png') });
  console.log('✓ Captured test_3d_exploded_oak.png');

  await context.close();

  // 2. Mobile Viewport Test (iPhone 13: 390x844)
  const mobileContext = await browser.newContext({
    ...devices['iPhone 13']
  });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = [];
  mobilePage.on('pageerror', err => mobileErrors.push(err.message));

  await mobilePage.goto(PROTO_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await mobilePage.waitForTimeout(1200);

  const mobileStatus = await mobilePage.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      noOverflow: document.documentElement.scrollWidth === document.documentElement.clientWidth
    };
  });
  console.log('Mobile Status (iPhone 13):', mobileStatus);
  console.log('Mobile Errors:', mobileErrors.length);

  await mobilePage.screenshot({ path: path.resolve('test_3d_mobile_iphone13.png') });
  console.log('✓ Captured test_3d_mobile_iphone13.png');

  await mobileContext.close();
  await browser.close();

  console.log('--- 3D PROTOTYPE AUDIT COMPLETE ---');
}

test3DPrototype().catch(err => {
  console.error('3D test failed:', err);
  process.exit(1);
});
