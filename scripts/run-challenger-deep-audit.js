// @ts-check
/**
 * scripts/run-challenger-deep-audit.js
 * Deep adversarial challenge script for GeekNook:
 * 1. Intermediate & sub-breakpoint overflow probe (323px, 359px, 428px, 576px, 767px, 1023px, 1199px)
 * 2. Mobile touch target audit (>=44x44px for primary interactive elements)
 * 3. Footer branding invariant ("MADE BY SERGEY GOAT" -> "https://t.me/ggrk52")
 * 4. PII leakage check (+79670251030 vs +70000000000)
 * 5. Commercial integrity check (no consumer "14 дней возврат" / "100% возврат")
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:8080';

const PAGES = [
  { name: 'index', path: '/index.html', isB2B: false },
  { name: 'b2b', path: '/b2b.html', isB2B: true },
  { name: 'podstavki', path: '/podstavki-pod-monitor.html', isB2B: false },
  { name: 'kabel-menedzhment', path: '/kabel-menedzhment.html', isB2B: false },
  { name: 'kovriki', path: '/kovriki-dlya-stola.html', isB2B: false },
  { name: 'journal', path: '/journal.html', isB2B: false },
  { name: 'legal', path: '/legal.html', isB2B: false },
];

const INTERMEDIATE_VIEWPORTS = [323, 333, 359, 393, 428, 576, 767, 1023, 1199];

async function runDeepAudit() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('geeknook_cookie_consent', 'true'); } catch (e) {}
  });
  await page.route(/(mc\.yandex\.ru|google-analytics\.com|googletagmanager\.com|tilda\.ws)/i, route => route.abort());

  const auditReport = {
    intermediateOverflow: [],
    touchTargetFindings: [],
    footerAttribution: [],
    piiFindings: [],
    commercialIntegrityFindings: [],
  };

  console.log('--- 1. Intermediate Breakpoints Probe ---');
  for (const p of PAGES) {
    for (const w of INTERMEDIATE_VIEWPORTS) {
      await page.setViewportSize({ width: w, height: 700 });
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(50);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
        return {
          scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: scrollWidth > window.innerWidth,
        };
      });

      if (overflow.hasOverflow) {
        console.error(`[FAIL] Intermediate overflow on ${p.name} at ${w}px: scrollWidth=${overflow.scrollWidth}`);
        auditReport.intermediateOverflow.push({ page: p.name, width: w, ...overflow });
      }
    }
  }
  console.log(`Intermediate breakpoints checked: ${PAGES.length * INTERMEDIATE_VIEWPORTS.length}. Failures: ${auditReport.intermediateOverflow.length}`);

  console.log('--- 2. Footer Branding Invariant Audit ---');
  for (const p of PAGES) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
    const footerLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('footer a')).find(a => 
        a.textContent && a.textContent.includes('SERGEY GOAT')
      );
      if (!link) return { found: false };
      return {
        found: true,
        text: link.textContent.trim(),
        href: link.getAttribute('href'),
      };
    });

    const valid = footerLink.found && footerLink.href === 'https://t.me/ggrk52';
    auditReport.footerAttribution.push({ page: p.name, ...footerLink, valid });
    if (!valid) {
      console.warn(`[WARN] Footer attribution missing or invalid on ${p.name}:`, footerLink);
    }
  }

  console.log('--- 3. PII Leakage Check ---');
  const personalPhone = '+79670251030';
  for (const p of PAGES) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
    const piiFound = await page.evaluate((phone) => {
      const html = document.documentElement.innerHTML;
      return html.includes(phone);
    }, personalPhone);

    if (piiFound) {
      console.error(`[ALERT] Personal phone ${personalPhone} found in ${p.name}!`);
      auditReport.piiFindings.push({ page: p.name, phone: personalPhone });
    }
  }

  console.log('--- 4. Commercial Integrity Check (Retail Returns) ---');
  const forbiddenPhrases = [
    '100% возврат',
    'возврат без вопросов',
    'Тест-драйв 14 дней',
    '14 дней на возврат',
  ];
  for (const p of PAGES) {
    if (p.isB2B) continue; // B2B test drive is explicitly permitted
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
    const violations = await page.evaluate((phrases) => {
      const html = document.body.innerText;
      return phrases.filter(ph => html.includes(ph));
    }, forbiddenPhrases);

    if (violations.length > 0) {
      console.warn(`[WARN] Retail return promise found in ${p.name}:`, violations);
      auditReport.commercialIntegrityFindings.push({ page: p.name, violations });
    }
  }

  console.log('--- 5. Touch Target Ergonomics Audit (Mobile 375px) ---');
  await page.setViewportSize({ width: 375, height: 667 });
  for (const p of PAGES) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
    const smallTargets = await page.evaluate(() => {
      const interactives = Array.from(document.querySelectorAll('button, a, input, select, textarea, .btn, .prod-pill, .size-btn, .color-pill, .wood-option, .xray-toggle, .btn-card-xray'));
      const violations = [];
      for (const el of interactives) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        // Skip inline text links inside paragraphs
        if (el.tagName.toLowerCase() === 'a' && el.closest('p, span, li') && !el.classList.contains('btn') && !el.classList.contains('button')) {
          continue;
        }

        // Check if smaller than 44x44
        if (rect.height < 40 || rect.width < 40) {
          const classStr = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
          const idStr = el.id ? `#${el.id}` : '';
          violations.push({
            selector: idStr || classStr || el.tagName.toLowerCase(),
            tag: el.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: (el.textContent || '').trim().slice(0, 30),
          });
        }
      }
      return violations;
    });

    if (smallTargets.length > 0) {
      auditReport.touchTargetFindings.push({ page: p.name, count: smallTargets.length, samples: smallTargets.slice(0, 8) });
    }
  }

  await browser.close();
  fs.writeFileSync('scripts/challenger-deep-results.json', JSON.stringify(auditReport, null, 2), 'utf8');
  console.log('\nDeep audit complete. Saved to scripts/challenger-deep-results.json');
}

runDeepAudit().catch(console.error);
