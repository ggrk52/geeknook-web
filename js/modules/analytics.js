/**
 * GeekNook Universal Analytics & E-commerce Tracking Engine
 * Supports:
 * - Yandex.Metrika (JavaScript Goals & E-commerce)
 * - dataLayer (Google Tag Manager / Universal Analytics standards)
 * - Tilda Headless & Standalone Cart/CRM event interception
 */
(function() {
  'use strict';

  window.GEEKNOOK_METRIKA_ID = 113130622;
  window.dataLayer = window.dataLayer || [];

  // Official Yandex.Metrika Counter Initialization (113130622)
  if (typeof window.ym !== 'function') {
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
    (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

    window.ym(113130622, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
      ecommerce: "dataLayer"
    });
  }

  // Helper: Find all active Yandex Metrika counter IDs in DOM / window
  function getActiveMetrikaCounters() {
    const counters = [];

    // 1. Check window.Ya._metrika.counters (Standard Yandex Metrika runtime)
    try {
      if (window.Ya && window.Ya._metrika && window.Ya._metrika.counters) {
        Object.keys(window.Ya._metrika.counters).forEach(id => {
          const n = parseInt(id, 10);
          if (!isNaN(n) && n > 0 && !counters.includes(n)) {
            counters.push(n);
          }
        });
      }
    } catch (e) {}

    // 2. Scan script tags for ym(XXXXXX, ...) calls
    try {
      const scripts = document.querySelectorAll('script');
      scripts.forEach(s => {
        const text = s.textContent || '';
        const match = text.match(/ym\((\d{6,10})/);
        if (match && match[1]) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > 0 && !counters.includes(n)) {
            counters.push(n);
          }
        }
      });
    } catch (e) {}

    // 3. Optional global override variable
    if (window.GEEKNOOK_METRIKA_ID) {
      const n = parseInt(window.GEEKNOOK_METRIKA_ID, 10);
      if (!isNaN(n) && n > 0 && !counters.includes(n)) {
        counters.push(n);
      }
    }

    return counters;
  }

  // Core Goal Dispatcher
  function reachGoal(goalName, params = {}) {
    if (!goalName) return;
    
    // Log to console in development / debug mode
    console.log(`[GeekNook Analytics] 🎯 Goal Triggered: «${goalName}»`, params);

    // 1. Send to Yandex Metrika
    if (typeof window.ym === 'function') {
      const counters = getActiveMetrikaCounters();
      if (counters.length > 0) {
        counters.forEach(counterId => {
          try {
            window.ym(counterId, 'reachGoal', goalName, params);
          } catch (err) {
            console.warn(`[GeekNook Analytics] Failed to send goal to Metrika ${counterId}:`, err);
          }
        });
      }
    }

    // 2. Push event to standard dataLayer (GTM / Yandex Ecommerce)
    try {
      window.dataLayer.push({
        event: goalName,
        goalName: goalName,
        goalParams: params,
        timestamp: Date.now()
      });
    } catch (e) {}
  }

  // E-commerce: Add to Cart
  function trackAddToCart(product) {
    if (!product) return;
    const prodId = product.sku || product.uid || product.id || 'GN-PRODUCT';
    const prodName = product.name || product.title || 'Товар GeekNook';
    const prodPrice = Number(product.price) || 0;
    const prodQty = parseInt(product.quantity, 10) || 1;
    const prodVariant = product.option || 'Стандарт';

    // dataLayer Ecommerce format
    try {
      window.dataLayer.push({
        event: 'addToCart',
        ecommerce: {
          currencyCode: 'RUB',
          add: {
            products: [{
              id: prodId,
              name: prodName,
              price: prodPrice,
              brand: 'GEEK NOOK',
              category: 'Премиальная эргономика',
              variant: prodVariant,
              quantity: prodQty
            }]
          }
        }
      });
    } catch (e) {}

    reachGoal('ADD_TO_CART', {
      id: prodId,
      name: prodName,
      price: prodPrice,
      variant: prodVariant,
      quantity: prodQty
    });
  }

  // E-commerce: Order Success (Purchase)
  function trackOrderSubmit(orderId, revenue, items = [], delivery = 'СДЭК', payment = 'При получении') {
    const safeOrderId = orderId || ('GN-' + Math.floor(100000 + Math.random() * 900000));
    const safeRevenue = Number(revenue) || 0;

    const formattedProducts = (items || []).map(i => ({
      id: i.sku || i.uid || i.id || 'GN-ITEM',
      name: i.name || i.title || 'Товар',
      price: Number(i.price) || 0,
      brand: 'GEEK NOOK',
      category: 'Премиальная эргономика',
      variant: i.option || 'Стандарт',
      quantity: parseInt(i.quantity, 10) || 1
    }));

    try {
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: {
          currencyCode: 'RUB',
          purchase: {
            actionField: {
              id: safeOrderId,
              revenue: safeRevenue,
              shipping: delivery.includes('Бесплат') ? 0 : 490
            },
            products: formattedProducts
          }
        }
      });
    } catch (e) {}

    reachGoal('SUBMIT_ORDER', {
      orderId: safeOrderId,
      revenue: safeRevenue,
      delivery: delivery,
      payment: payment,
      itemsCount: formattedProducts.length
    });
  }

  function trackCartOpen() {
    reachGoal('OPEN_CART');
  }

  function trackCdekMapClick() {
    reachGoal('CLICK_CDEK_MAP');
  }

  function trackB2bLead(company, email, workplaces) {
    reachGoal('B2B_LEAD', {
      company: company || 'Не указано',
      email: email || '',
      workplaces: workplaces || '5-10'
    });
  }

  function trackTelegramConsult(source = 'general') {
    reachGoal('TG_CONSULT', { source });
  }

  function trackTelegramOrder(orderType = 'cart', details = {}) {
    if (window.geekNookAnalytics && typeof window.geekNookAnalytics.reachGoal === 'function' && window.geekNookAnalytics.reachGoal !== reachGoal) {
      window.geekNookAnalytics.reachGoal('TG_ORDER', { type: orderType, ...details });
    } else {
      reachGoal('TG_ORDER', { type: orderType, ...details });
    }
  }

  function trackRetailClick(store) {
    reachGoal('RETAIL_CLICK', { store });
  }

  function trackJournalCta(articleTitle, target) {
    reachGoal('JOURNAL_CTA', {
      article: articleTitle || document.title,
      target: target || 'catalog'
    });
  }

  // --- UTM PARAMETERS ENGINE (152-ФЗ / Yandex Direct / Ads attribution) ---
  const UTM_STORAGE_KEY = 'geeknook_utm_params';
  const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];

  function captureUtmParams() {
    try {
      if (typeof window === 'undefined' || !window.location || !window.location.search) return;
      const urlParams = new URLSearchParams(window.location.search);
      const captured = {};
      let hasUtm = false;

      UTM_FIELDS.forEach(field => {
        const val = urlParams.get(field);
        if (val) {
          captured[field] = val.trim();
          hasUtm = true;
        }
      });

      if (hasUtm) {
        let existing = {};
        try {
          const stored = localStorage.getItem(UTM_STORAGE_KEY) || sessionStorage.getItem(UTM_STORAGE_KEY);
          if (stored) existing = JSON.parse(stored);
        } catch (e) {}

        const merged = { ...existing, ...captured, captured_at: new Date().toISOString() };
        const json = JSON.stringify(merged);
        try { localStorage.setItem(UTM_STORAGE_KEY, json); } catch(e) {}
        try { sessionStorage.setItem(UTM_STORAGE_KEY, json); } catch(e) {}
        console.log('[GeekNook Analytics] 🏷️ Captured UTM parameters:', captured);
      }
    } catch (e) {
      console.warn('[GeekNook Analytics] Could not capture UTM params:', e);
    }
  }

  function getUtmParams() {
    try {
      const stored = localStorage.getItem(UTM_STORAGE_KEY) || sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  }

  function getUtmString() {
    const params = getUtmParams();
    const parts = [];
    UTM_FIELDS.forEach(field => {
      if (params[field]) parts.push(`${field}=${params[field]}`);
    });
    return parts.join('&');
  }

  // Capture UTM immediately
  captureUtmParams();

  // Export to global namespace
  window.geekNookAnalytics = {
    reachGoal,
    trackAddToCart,
    trackOrderSubmit,
    trackCartOpen,
    trackCdekMapClick,
    trackB2bLead,
    trackTelegramConsult,
    trackTelegramOrder,
    trackRetailClick,
    trackJournalCta,
    captureUtmParams,
    getUtmParams,
    getUtmString,
    getActiveCounters: getActiveMetrikaCounters
  };

  // Global automatic event listeners (Zero-overhead click delegation)
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a, button, [data-analytics-goal]');
    if (!target) return;

    // Explicit data attribute
    const explicitGoal = target.getAttribute('data-analytics-goal');
    if (explicitGoal) {
      reachGoal(explicitGoal, {
        text: target.textContent.trim().slice(0, 50),
        id: target.id || undefined
      });
      return;
    }

    const href = (target.getAttribute('href') || '').toLowerCase();

    // CDEK offices map link
    if (href.includes('cdek.ru/ru/offices') || target.classList.contains('cdek-map-helper-link') || target.closest('.cdek-map-helper-link')) {
      trackCdekMapClick();
      return;
    }

    // Telegram support / consultation
    if (href.includes('t.me/geeknook')) {
      const source = target.closest('#supportDropdown') ? 'support_widget' : (target.closest('.journal-cta-card') ? 'journal_article' : 'site_link');
      trackTelegramConsult(source);
      return;
    }

    // Retail partner links
    if (href.includes('restore.ru') || target.closest('.retail-card:nth-child(1)')) {
      if (target.tagName === 'A' && href.includes('restore')) {
        trackRetailClick('restore');
      }
    }
    if (href.includes('technopark.ru') || target.closest('.retail-card:nth-child(2)')) {
      if (target.tagName === 'A' && href.includes('technopark')) {
        trackRetailClick('technopark');
      }
    }

    // Journal CTA buttons
    if (target.classList.contains('journal-cta-btn') || target.closest('.journal-cta-card a.journal-cta-btn')) {
      trackJournalCta(document.title, target.getAttribute('href') || 'catalog');
    }
  }, { passive: true });

  // Tilda native cart success listener
  document.addEventListener('tilda-cart-order-success', function() {
    try {
      const cartData = window.tcart || {};
      const prods = (cartData.products || []).map(p => ({
        sku: p.sku || p.uid || p.id,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        option: (p.options || []).map(o => o.variant).join(', ')
      }));
      const orderNum = cartData.orderid || ('GN-' + Math.floor(100000 + Math.random() * 900000));
      const total = cartData.amount || 0;
      trackOrderSubmit(orderNum, total, prods, 'СДЭК', 'Онлайн / ПВЗ');
    } catch (err) {
      console.warn('[GeekNook Analytics] Error parsing tilda-cart-order-success:', err);
    }
  });

  // Fallback observer for Tilda success message appearance
  if (typeof MutationObserver !== 'undefined') {
    let firedTildaSuccess = false;
    const observer = new MutationObserver(function() {
      const successBox = document.querySelector('.t706__orderform .t-form__successbox, .t706 .js-successbox');
      if (successBox && !firedTildaSuccess) {
        const style = window.getComputedStyle(successBox);
        if (style.display !== 'none' && style.visibility !== 'hidden' && successBox.textContent.trim().length > 0) {
          firedTildaSuccess = true;
          console.log('[GeekNook Analytics] Detected visible Tilda successbox');
          reachGoal('SUBMIT_ORDER', { source: 'tilda_dom_successbox' });
          setTimeout(() => { firedTildaSuccess = false; }, 15000);
        }
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
    }
  }

  console.log('[GeekNook Analytics] Initialized successfully. Ready for Yandex.Metrika & Ecommerce.');
})();
