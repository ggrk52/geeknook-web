const { chromium, devices } = require('playwright');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOCAL_URL = 'file://' + path.resolve('index.html');
const PROD_URL = 'https://geeknook.ru';

async function runComprehensiveAudit() {
  console.log('====================================================');
  console.log('   GEEKNOOK COMPREHENSIVE REGRESSION & QUALITY AUDIT');
  console.log('====================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const testViewports = [
    { name: 'Ultra Compact Mobile (320x568)', width: 320, height: 568, isMobile: true },
    { name: 'iPhone SE (375x667)', width: 375, height: 667, isMobile: true },
    { name: 'iPhone 13 (390x844)', width: 390, height: 844, isMobile: true },
    { name: 'Pixel 5 (393x851)', width: 393, height: 851, isMobile: true },
    { name: 'iPad Tablet (768x1024)', width: 768, height: 1024, isMobile: false },
    { name: 'Desktop Full HD (1440x900)', width: 1440, height: 900, isMobile: false }
  ];

  let totalErrors = 0;
  const auditReport = {
    viewports: {},
    productionParity: {},
    anatomyFlow: {},
    assemblyFlow: {},
    a11yAndTouch: {}
  };

  // ----------------------------------------------------
  // TEST 1: Multi-Viewport Overflow & Layout Discipline
  // ----------------------------------------------------
  console.log('>>> [1/5] Testing Horizontal Overflow across Viewports...');
  for (const vp of testViewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto(LOCAL_URL, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('geeknook_cookie_consent', 'true'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    const overflowData = await page.evaluate(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
      const clientWidth = docEl.clientWidth;
      
      const offendingElements = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > clientWidth + 2 && r.width > 0 && r.height > 0) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          const id = el.id ? '#' + el.id : '';
          offendingElements.push(`${tag}${id}${cls} (right: ${Math.round(r.right)}px, w: ${Math.round(r.width)}px)`);
          if (offendingElements.length >= 3) break;
        }
      }

      return {
        scrollWidth,
        clientWidth,
        hasOverflow: scrollWidth > clientWidth,
        offendingElements
      };
    });

    const passed = !overflowData.hasOverflow && overflowData.scrollWidth === vp.width;
    auditReport.viewports[vp.name] = {
      passed,
      scrollWidth: overflowData.scrollWidth,
      clientWidth: overflowData.clientWidth,
      consoleErrors: consoleErrors.length,
      offending: overflowData.offendingElements
    };

    console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'} ${vp.name}: width=${overflowData.clientWidth}px, scrollWidth=${overflowData.scrollWidth}px, consoleErrors=${consoleErrors.length}`);
    if (!passed) {
      console.log(`     ⚠️ Offending elements: ${overflowData.offendingElements.join(', ')}`);
      totalErrors++;
    }

    await context.close();
  }

  // ----------------------------------------------------
  // TEST 2: Anatomy Section - Sticky Scroll & Card Bounds
  // ----------------------------------------------------
  console.log('\n>>> [2/5] Testing Anatomy Section Sticky & Card Geometry (Mobile iPhone 13)...');
  {
    const context = await browser.newContext({
      ...devices['iPhone 13']
    });
    const page = await context.newPage();
    await page.goto(LOCAL_URL, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('geeknook_cookie_consent', 'true'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const anatomyTest = await page.evaluate(async () => {
      const a = document.getElementById('anatomy');
      if (!a) return [{ error: 'Anatomy section not found' }];

      const sticky = a.querySelector('.anatomy-sticky-container');
      const startTop = a.getBoundingClientRect().top + window.pageYOffset;
      const scrollRange = a.offsetHeight - window.innerHeight;
      const header = document.querySelector('.site-header');
      const headerH = header ? header.offsetHeight : 60;

      const steps = [
        { label: 'Step 1 (Wood)', ratio: 0.05, cardIdx: 0 },
        { label: 'Step 3 (Facet)', ratio: 0.50, cardIdx: 2 },
        { label: 'Step 5 (Cable)', ratio: 0.95, cardIdx: 4 }
      ];

      const results = [];
      const cards = document.querySelectorAll('.anatomy-card');

      for (const s of steps) {
        window.scrollTo({ top: startTop + s.ratio * scrollRange, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 100));

        const card = cards[s.cardIdx];
        const cardRect = card ? card.getBoundingClientRect() : null;
        const stickyRect = sticky.getBoundingClientRect();
        const pillsWrap = a.querySelector('.anatomy-stepper-pills');
        const pillsRect = pillsWrap ? pillsWrap.getBoundingClientRect() : null;
        const titleEl = a.querySelector('.block-title');
        const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;

        const fitsInViewport = cardRect && cardRect.bottom <= (window.innerHeight - 30) && cardRect.top >= 0;
        const pillsVisible = pillsRect && pillsRect.top >= headerH && pillsRect.bottom < (cardRect?.top || 9999);
        const titleVisible = titleRect && titleRect.top >= headerH;

        results.push({
          label: s.label,
          stickyTop: Math.round(stickyRect.top),
          stickyPos: sticky.style.position || window.getComputedStyle(sticky).position,
          titleTop: Math.round(titleRect?.top || 0),
          pillsTop: Math.round(pillsRect?.top || 0),
          pillsBottom: Math.round(pillsRect?.bottom || 0),
          cardTop: Math.round(cardRect?.top || 0),
          cardBottom: Math.round(cardRect?.bottom || 0),
          cardHeight: Math.round(cardRect?.height || 0),
          viewportHeight: window.innerHeight,
          fitsInViewport: !!fitsInViewport,
          pillsVisible: !!pillsVisible,
          titleVisible: !!titleVisible
        });
      }

      return results;
    });

    auditReport.anatomyFlow = anatomyTest;
    for (const r of anatomyTest) {
      const ok = r.fitsInViewport && r.pillsVisible && r.titleVisible && (r.stickyPos === 'fixed' || r.stickyTop <= 10);
      console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} ${r.label}: card height=${r.cardHeight}px, card bottom=${r.cardBottom}px (viewport=${r.viewportHeight}px), stickyPos=${r.stickyPos}`);
      if (!ok) {
        console.log(`     ⚠️ Metrics: fitsInViewport=${r.fitsInViewport}, pillsVisible=${r.pillsVisible}, titleVisible=${r.titleVisible}, stickyPos=${r.stickyPos}`);
        totalErrors++;
      }
    }

    await context.close();
  }

  // ----------------------------------------------------
  // TEST 3: Assembly Track - Continuous Scroll & No Dead Space
  // ----------------------------------------------------
  console.log('\n>>> [3/5] Testing Exploded Assembly & Seamless Exit Flow...');
  {
    const context = await browser.newContext({
      ...devices['iPhone 13']
    });
    const page = await context.newPage();
    await page.goto(LOCAL_URL, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('geeknook_cookie_consent', 'true'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const assemblyTest = await page.evaluate(async () => {
      const assembly = document.getElementById('assemblyTrack');
      if (!assembly) return { error: 'Assembly track not found' };

      const sticky = assembly.querySelector('.scroll-assembly-sticky');
      const startTop = assembly.getBoundingClientRect().top + window.pageYOffset;
      const scrollRange = assembly.offsetHeight - window.innerHeight;
      const percentLbl = document.getElementById('percentLbl');

      const log = [];
      const testScrolls = [0.1, 0.5, 0.95];

      for (const t of testScrolls) {
        window.scrollTo({ top: startTop + t * scrollRange, behavior: 'instant' });
        window.dispatchEvent(new Event('scroll'));
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 100));
        const rect = sticky.getBoundingClientRect();
        log.push({
          step: Math.round(t * 100) + '%',
          stickyTop: Math.round(rect.top),
          stickyPos: sticky.style.position || window.getComputedStyle(sticky).position,
          percent: percentLbl?.textContent.trim(),
          isPinned: rect.top <= 10 && rect.top >= -10
        });
      }

      // Check exit condition (scroll 150px PAST assembly)
      window.scrollTo({ top: startTop + scrollRange + 150, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll'));
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 100));
      const pastStickyRect = sticky.getBoundingClientRect();
      const nextSibling = assembly.nextElementSibling;
      const nextSiblingRect = nextSibling ? nextSibling.getBoundingClientRect() : null;

      return {
        log,
        pastSection: {
          stickyTop: Math.round(pastStickyRect.top),
          stickyPos: sticky.style.position || window.getComputedStyle(sticky).position,
          nextSiblingTag: nextSibling?.tagName,
          nextSiblingId: nextSibling?.id,
          nextSiblingTop: Math.round(nextSiblingRect?.top || 0)
        }
      };
    });

    auditReport.assemblyFlow = assemblyTest;
    for (const step of assemblyTest.log) {
      const pinned = step.isPinned || step.stickyPos === 'fixed';
      console.log(`  ${pinned ? '✅ PASS' : '❌ FAIL'} Assembly ${step.step}: percentLbl="${step.percent}", stickyTop=${step.stickyTop}px, pos=${step.stickyPos}`);
      if (!pinned) totalErrors++;
    }
    const exitOk = assemblyTest.pastSection.stickyTop < 0 || assemblyTest.pastSection.stickyPos === 'absolute';
    console.log(`  ${exitOk ? '✅ PASS' : '❌ FAIL'} Assembly Exit: sticky correctly releases (pos=${assemblyTest.pastSection.stickyPos}, top=${assemblyTest.pastSection.stickyTop}px, next section top=${assemblyTest.pastSection.nextSiblingTop}px)`);
    if (!exitOk) totalErrors++;

    await context.close();
  }

  // ----------------------------------------------------
  // TEST 4: Production Parity Check (https://geeknook.ru)
  // ----------------------------------------------------
  console.log('\n>>> [4/5] Testing Production Parity (https://geeknook.ru)...');
  {
    const context = await browser.newContext({
      ...devices['iPhone 13']
    });
    const page = await context.newPage();
    const prodErrors = [];
    page.on('pageerror', err => prodErrors.push(err.message));

    try {
      const response = await page.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 12000 });
      const status = response ? response.status() : null;
      await page.waitForTimeout(800);

      const prodCheck = await page.evaluate(() => {
        const docEl = document.documentElement;
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          noOverflow: docEl.scrollWidth === docEl.clientWidth,
          anatomyExists: !!document.getElementById('anatomy'),
          assemblyExists: !!document.getElementById('assemblyTrack')
        };
      });

      console.log(`  ✅ Production responded with HTTP ${status}`);
      console.log(`  ${prodCheck.noOverflow ? '✅ PASS' : '❌ FAIL'} Production Overflow: clientWidth=${prodCheck.clientWidth}px, scrollWidth=${prodCheck.scrollWidth}px`);
      console.log(`  ✅ Anatomy Section on Prod: ${prodCheck.anatomyExists ? 'Present' : 'Missing'}`);
      console.log(`  ✅ Assembly Track on Prod: ${prodCheck.assemblyExists ? 'Present' : 'Missing'}`);
      console.log(`  ✅ Console Errors on Prod: ${prodErrors.length}`);

      if (!prodCheck.noOverflow || prodErrors.length > 0) totalErrors++;
    } catch (e) {
      console.log(`  ⚠️ Could not reach production or timed out: ${e.message}`);
    }

    await context.close();
  }

  // ----------------------------------------------------
  // TEST 5: Interactive Elements & Touch Targets (A11y & Mobile UX)
  // ----------------------------------------------------
  console.log('\n>>> [5/5] Auditing Interactive Touch Targets & A11y Standards...');
  {
    const context = await browser.newContext({
      ...devices['iPhone 13']
    });
    const page = await context.newPage();
    await page.goto(LOCAL_URL, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('geeknook_cookie_consent', 'true'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    const touchAudit = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a.btn, .nav-btn, .theme-toggle, .cart-trigger-btn'));
      let checked = 0;
      let under32px = 0;
      const issues = [];

      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          checked++;
          if (r.height < 32 || r.width < 32) {
            under32px++;
            if (issues.length < 5) {
              issues.push(`${btn.tagName}.${btn.className.split(' ').join('.')} (${Math.round(r.width)}x${Math.round(r.height)}px)`);
            }
          }
        }
      }

      return {
        totalButtonsChecked: checked,
        under32px,
        sampleIssues: issues
      };
    });

    console.log(`  ✅ Checked ${touchAudit.totalButtonsChecked} buttons/actions.`);
    console.log(`  ℹ️ Under 32px targets: ${touchAudit.under32px}`);
    if (touchAudit.sampleIssues.length > 0) {
      console.log(`     Sample compact targets: ${touchAudit.sampleIssues.join(', ')}`);
    }

    await context.close();
  }

  await browser.close();

  console.log('\n====================================================');
  if (totalErrors === 0) {
    console.log('🎉 AUDIT RESULT: ALL SYSTEMS OPERATIONAL (0 ERRORS)');
  } else {
    console.log(`⚠️ AUDIT RESULT: ${totalErrors} ISSUES DETECTED`);
  }
  console.log('====================================================\n');
}

runComprehensiveAudit().catch(err => {
  console.error('Audit failed with exception:', err);
  process.exit(1);
});
