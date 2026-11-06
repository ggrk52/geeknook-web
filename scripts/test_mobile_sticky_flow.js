const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  const context = await browser.newContext({
    ...devices['iPhone 13']
  });
  const page = await context.newPage();

  // Test 1: Local index.html
  await page.goto('file://' + path.resolve('index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  console.log('--- TEST 1: MOBILE SCROLL AUDIT (iPhone 13: 390x844) ---');

  // Evaluate Anatomy Section scrolling
  const anatomyResults = await page.evaluate(async () => {
    const anatomy = document.getElementById('anatomy');
    const sticky = anatomy.querySelector('.anatomy-sticky-container');
    const track = document.getElementById('anatomyTrack');
    const pills = document.querySelectorAll('.anatomy-step-pill');
    const counter = document.getElementById('anatomyCounterDisplay');

    const startTop = anatomy.getBoundingClientRect().top + window.pageYOffset;
    const scrollRange = anatomy.offsetHeight - window.innerHeight;

    const steps = [0.0, 0.25, 0.5, 0.75, 1.0];
    const log = [];

    for (const step of steps) {
      window.scrollTo(0, startTop + step * scrollRange);
      await new Promise(r => setTimeout(r, 60));
      const stickyRect = sticky.getBoundingClientRect();
      const trackTransform = track.style.transform;
      const activePill = document.querySelector('.anatomy-step-pill.active')?.textContent.trim();
      log.push({
        step,
        stickyTop: Math.round(stickyRect.top),
        stickyPos: sticky.style.position || window.getComputedStyle(sticky).position,
        trackTransform,
        activePill,
        counter: counter?.textContent.trim()
      });
    }

    return {
      scrollRange,
      log
    };
  });

  console.log('Anatomy Scroll Results:\n', JSON.stringify(anatomyResults, null, 2));

  // Evaluate Assembly Track Section scrolling
  const assemblyResults = await page.evaluate(async () => {
    const assembly = document.getElementById('assemblyTrack');
    const sticky = assembly.querySelector('.scroll-assembly-sticky');
    const percentLbl = document.getElementById('percentLbl');
    const title = document.getElementById('assemblyTitle');

    const startTop = assembly.getBoundingClientRect().top + window.pageYOffset;
    const scrollRange = assembly.offsetHeight - window.innerHeight;

    const steps = [0.0, 0.25, 0.5, 0.75, 1.0];
    const log = [];

    for (const step of steps) {
      window.scrollTo(0, startTop + step * scrollRange);
      await new Promise(r => setTimeout(r, 60));
      const stickyRect = sticky.getBoundingClientRect();
      log.push({
        step,
        stickyTop: Math.round(stickyRect.top),
        stickyPos: sticky.style.position || window.getComputedStyle(sticky).position,
        percent: percentLbl?.textContent.trim(),
        title: title?.textContent.trim()
      });
    }

    // Also check when scrolled 200px PAST the assembly section
    window.scrollTo(0, startTop + scrollRange + 200);
    await new Promise(r => setTimeout(r, 60));
    const pastRect = sticky.getBoundingClientRect();
    const boardsRect = document.getElementById('boards')?.getBoundingClientRect();

    return {
      scrollRange,
      log,
      pastSection: {
        stickyTop: Math.round(pastRect.top),
        stickyPos: sticky.style.position,
        boardsTop: Math.round(boardsRect?.top || 0)
      }
    };
  });

  console.log('\nAssembly Scroll Results:\n', JSON.stringify(assemblyResults, null, 2));

  // Take screenshot of mobile assembly at 50%
  const assembly = await page.$('#assemblyTrack');
  const startTop = await page.evaluate(() => {
    const a = document.getElementById('assemblyTrack');
    return a.getBoundingClientRect().top + window.pageYOffset + (a.offsetHeight - window.innerHeight) * 0.5;
  });
  await page.evaluate((top) => window.scrollTo(0, top), startTop);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve('test_mobile_assembly_50pct.png') });

  // Test 2: SIMULATED TILDA ENVIRONMENT with inline overflow: auto on ancestor
  console.log('\n--- TEST 2: SIMULATED TILDA ENVIRONMENT (Ancestors with overflow: auto) ---');
  const tildaSimResult = await page.evaluate(async () => {
    // Inject mock Tilda wrappers around body content if not present
    let tRec = document.querySelector('.r.t-rec');
    if (!tRec) {
      tRec = document.createElement('div');
      tRec.className = 'r t-rec';
      tRec.id = 'rec3930221001';
      tRec.style.cssText = 'overflow: auto; width: 100%;';
      // Wrap assemblyTrack inside it
      const assembly = document.getElementById('assemblyTrack');
      assembly.parentNode.insertBefore(tRec, assembly);
      tRec.appendChild(assembly);
    } else {
      tRec.style.overflow = 'auto';
    }

    // Scroll to 50% of assembly
    const startTop = tRec.getBoundingClientRect().top + window.pageYOffset;
    const totalScroll = tRec.offsetHeight - window.innerHeight;
    window.scrollTo(0, startTop + totalScroll * 0.5);
    await new Promise(r => setTimeout(r, 100));

    const sticky = document.querySelector('.scroll-assembly-sticky');
    const stickyRect = sticky.getBoundingClientRect();

    return {
      tRecOverflow: window.getComputedStyle(tRec).overflow,
      stickyTop: Math.round(stickyRect.top),
      stickyPos: sticky.style.position,
      percent: document.getElementById('percentLbl')?.textContent.trim()
    };
  });

  console.log('Tilda Simulated Result:\n', JSON.stringify(tildaSimResult, null, 2));

  // Check horizontal overflow
  const overflowCheck = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth === document.documentElement.clientWidth
    };
  });
  console.log('\nHorizontal Overflow Check:', overflowCheck);

  await browser.close();
})();
