const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined
  });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile_375', width: 375, height: 667 },
    { name: 'mobile_320', width: 320, height: 568 }
  ];

  const htmlUrl = 'file://' + path.resolve('test-scroll-assembly.html');
  const outDir = '/Users/sergejzatovka/.gemini/antigravity/brain/7292da22-d4dd-43a6-b710-07c4cf4f5933';

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts && document.fonts.ready);

    // Check zero horizontal overflow
    const overflowCheck = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        overflow: doc.scrollWidth > doc.clientWidth
      };
    });

    console.log(`[Viewport ${vp.name} (${vp.width}px)] overflow: ${overflowCheck.overflow} (clientWidth=${overflowCheck.clientWidth}, scrollWidth=${overflowCheck.scrollWidth})`);

    // Scroll to 0%, 50%, 100% of assembly track
    const trackInfo = await page.evaluate(() => {
      const el = document.getElementById('assemblyTrack');
      return { top: el.offsetTop, height: el.offsetHeight };
    });

    for (const pct of [0, 50, 85, 100]) {
      const scrollY = trackInfo.top + (trackInfo.height - vp.height) * (pct / 100);
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(100);

      const shotPath = path.join(outDir, `assembly_${vp.name}_${pct}pct.png`);
      await page.screenshot({ path: shotPath });
      console.log(`  Captured ${path.basename(shotPath)}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('Verification finished successfully.');
})();
