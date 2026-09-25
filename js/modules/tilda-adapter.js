/**
 * GeekNook Tilda Headless E-commerce & CRM Adapter
 * Connects GeekNook frontend with Tilda's native backend:
 * - Tilda Cart (tcart / ST100)
 * - Tilda Payments (YooKassa / Tinkoff / Sber / SBP / Dolame)
 * - Tilda Delivery (CDEK / Boxberry)
 * - Tilda CRM / Leads database
 * - Telegram / Email order dispatches
 */
(function() {
  'use strict';

  function isTildaActive() {
    return (
      typeof window.tcart__addProduct === 'function' ||
      typeof window.tcart !== 'undefined' ||
      Boolean(document.querySelector('.t706, .t-cart, [data-block-type="706"]')) ||
      Boolean(window.GEEKNOOK_FORCE_TILDA)
    );
  }

  function initTildaAdapter() {
    if (!window.geekNookApp) {
      setTimeout(initTildaAdapter, 50);
      return;
    }

    if (!isTildaActive()) {
      console.log('[GeekNook] Tilda environment not detected, using native standalone cart.');
      return;
    }

    console.log('[GeekNook] ⚡ Tilda Headless Adapter activated! Connecting cart & CRM...');

    const originalApp = window.geekNookApp;
    const cdnBase = window.GEEKNOOK_CDN_URL || 'https://ggrk52.github.io/geeknook-web/';

    function toFullCdnUrl(path) {
      if (!path) return '';
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      const clean = path.replace(/^\.?\//, '');
      return cdnBase.endsWith('/') ? cdnBase + clean : cdnBase + '/' + clean;
    }

    // Official warehouse SKU map for Focus Station variants (85 cm and 116 cm)
    const FOCUS_STATION_SKUS = {
      'walnut_85': { sku: '1000830012', part: 'G4N-202404201', name: 'Monitor Stand GEEK NOOK Focus Station 85x9x23 cm, Walnut', price: 19990, dimensions: '85 × 9 × 23 см' },
      'walnut_116': { sku: '1000830013', part: 'G4N-202404202', name: 'Monitor Stand GEEK NOOK Focus Station 116x9x23 cm, Walnut', price: 24990, dimensions: '116 × 9 × 23 см' },
      'oak_85': { sku: '1000830014', part: 'G4N-2024042003', name: 'Monitor stand GEEK NOOK Focus Station 85x9x23 cm, Oak', price: 19990, dimensions: '85 × 9 × 23 см' },
      'oak_116': { sku: '1000830015', part: 'G4N-2024042004', name: 'Monitor stand GEEK NOOK Focus Station 116x9x23 cm, Oak', price: 24990, dimensions: '116 × 9 × 23 см' },
      'black_85': { sku: '1000830016', part: 'G4N-202404205', name: 'Monitor stand GEEK NOOK Focus Station 85x9x23 cm, Black', price: 19990, dimensions: '85 × 9 × 23 см' },
      'black_116': { sku: '1000830017', part: 'G4N-2024042006', name: 'Monitor stand GEEK NOOK Focus Station 116x9x23 cm, Black', price: 24990, dimensions: '116 × 9 × 23 см' }
    };

    // Helper: Map GeekNook product to Tilda Cart format
    function mapProductToTilda(productId, optionName) {
      if (!window.GEEKNOOK_DATA) return null;
      const p = (window.GEEKNOOK_DATA.allProducts || []).find(item => item.id === productId);
      if (!p) {
        // Check if bundle
        const b = (window.GEEKNOOK_DATA.bundles || []).find(item => item.id === productId);
        if (b) {
          const bSku = b.sku || `GN-BDL-${b.id}`;
          return {
            name: b.title,
            price: b.price,
            sku: bSku,
            uid: bSku,
            img: toFullCdnUrl(b.image),
            options: [
              { option: 'Артикул', name: 'Артикул', variant: b.part || bSku },
              { option: 'SKU', name: 'SKU', variant: bSku },
              { option: 'Комплектация', name: 'Комплектация', variant: (b.items || []).join(', ') }
            ]
          };
        }
        return null;
      }

      const imgPath = (p.images && p.images[0]) ? p.images[0] : (p.image || '');
      let opt = optionName;
      if (!opt || opt === 'Стандарт') {
        if (p.options && p.options.lengths && p.options.lengths.length) {
          opt = p.options.lengths[0];
        } else {
          opt = 'Стандарт';
        }
      }

      let resolvedPrice = p.price;
      if (p.optionPrices && p.optionPrices[opt]) {
        resolvedPrice = p.optionPrices[opt];
      }

      let resolvedSku = p.sku || '';
      const itemOptions = [];

      // For products that actually have variants (e.g. Focus Station boards with 85/116 cm, or custom variants)
      const hasRealVariants = (p.options && p.options.lengths && p.options.lengths.length) || (opt !== 'Стандарт');
      if (hasRealVariants) {
        itemOptions.push({ option: 'Вариант', name: 'Вариант', variant: opt });
      }

      // If product has warehouse SKU definitions for this option, attach them for CRM & 1C
      if (p.skus && p.skus[opt]) {
        const skuInfo = p.skus[opt];
        resolvedSku = skuInfo.sku || resolvedSku;
        itemOptions.push({ option: 'Габариты', name: 'Габариты', variant: skuInfo.dimensions });
        itemOptions.push({ option: 'Артикул', name: 'Артикул', variant: skuInfo.part });
        itemOptions.push({ option: 'SKU', name: 'SKU', variant: skuInfo.sku });
      } else {
        if (p.part) {
          itemOptions.push({ option: 'Артикул', name: 'Артикул', variant: p.part });
        }
        if (resolvedSku) {
          itemOptions.push({ option: 'SKU', name: 'SKU', variant: resolvedSku });
        }
      }

      return {
        name: p.title,
        price: resolvedPrice,
        sku: resolvedSku,
        uid: resolvedSku || p.id,
        img: toFullCdnUrl(imgPath),
        options: itemOptions
      };
    }

    // --- 1. OVERRIDE: addToCart ---
    window.geekNookApp.addToCart = function(productId, optionName = 'Стандарт', openDrawer = true) {
      const item = mapProductToTilda(productId, optionName);
      if (!item) {
        originalApp.addToCart(productId, optionName, openDrawer);
        return;
      }

      if (typeof window.tcart__addProduct === 'function') {
        window.tcart__addProduct(item);
        if (openDrawer && typeof window.tcart__openCart === 'function') {
          window.tcart__openCart();
        }
      } else {
        originalApp.addToCart(productId, optionName, openDrawer);
      }

      syncTildaCartBadge();
      if (typeof originalApp.showToast === 'function') {
        originalApp.showToast(`«${item.name}» добавлен в корзину!`);
      }
    };

    // --- 2. OVERRIDE: quickAddWithFeedback ---
    window.geekNookApp.quickAddWithFeedback = function(btnEl, productId, optionName = 'Стандарт') {
      window.geekNookApp.addToCart(productId, optionName, true);
      if (btnEl) {
        btnEl.classList.add('added');
        const isGlassBtn = btnEl.classList.contains('quick-add-btn');
        const origHtml = btnEl.innerHTML;
        btnEl.innerHTML = isGlassBtn
          ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Добавлено!</span>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => {
          btnEl.classList.remove('added');
          btnEl.innerHTML = origHtml;
        }, 1200);
      }
    };

    // --- 3. OVERRIDE: addFromQuickView ---
    window.geekNookApp.addFromQuickView = function(productId) {
      const modal = document.getElementById('quickViewModal');
      let opt = 'Стандарт';
      const activeChip = modal ? modal.querySelector('.option-chip.active') : null;
      if (activeChip) {
        opt = activeChip.getAttribute('data-val') || 'Стандарт';
      }
      window.geekNookApp.addToCart(productId, opt, true);
      if (typeof window.geekNookApp.closeModal === 'function') {
        window.geekNookApp.closeModal('quickViewModal');
      }
    };

    // --- 4. OVERRIDE: openCartDrawer ---
    window.geekNookApp.openCartDrawer = function() {
      if (typeof window.tcart__openCart === 'function') {
        window.tcart__openCart();
      } else {
        originalApp.openCartDrawer();
      }
      syncTildaCartBadge();
    };

    // --- 5. OVERRIDE: openCheckout / QuickBuy ---
    window.geekNookApp.openQuickBuy = function(productId) {
      window.geekNookApp.addToCart(productId, 'Стандарт', true);
    };

    // --- 6. OVERRIDE: addConfiguredBundleToCart (Focus Station 3D Configurator) ---
    window.geekNookApp.addConfiguredBundleToCart = function() {
      const data = window.GEEKNOOK_DATA;
      if (!data || !data.configurator) {
        originalApp.addConfiguredBundleToCart();
        return;
      }

      const state = window.geekNookApp.state || {};
      const config = state.config || {};
      const finish = data.configurator.finishes.find(f => f.id === config.finishId) || data.configurator.finishes[0];
      const length = data.configurator.lengths.find(l => l.id === config.lengthId) || data.configurator.lengths[0];

      let grandTotal = length.priceBase + finish.priceDelta;
      const addonNames = [];
      (config.selectedAddonIds || []).forEach(id => {
        const a = data.configurator.addons.find(x => x.id === id);
        if (a) {
          grandTotal += a.price;
          addonNames.push(a.name);
        }
      });
      if (config.engravingEnabled) grandTotal += 1200;

      const finishKey = finish.id === 'oak' ? 'oak' : (finish.id === 'black' ? 'black' : 'walnut');
      const skuKey = `${finishKey}_${length.id}`;
      const skuInfo = FOCUS_STATION_SKUS[skuKey];

      const title = `Focus Station ${length.id} см (${finish.name})`;
      const options = [
        { option: 'Длина основания', name: 'Длина основания', variant: length.id + ' см' },
        { option: 'Габариты', name: 'Габариты', variant: skuInfo ? skuInfo.dimensions : `${length.id} × 9 × 23 см` },
        { option: 'Порода дерева', name: 'Порода дерева', variant: finish.name },
        { option: 'Артикул', name: 'Артикул', variant: skuInfo ? skuInfo.part : 'G4N-FOCUS' },
        { option: 'SKU', name: 'SKU', variant: skuInfo ? skuInfo.sku : '' },
        { option: 'Лазерная гравировка', name: 'Лазерная гравировка', variant: config.engravingEnabled ? (config.engravingText || 'GEEKNOOK // LAB') : 'Без гравировки' },
        { option: 'T-Track аксессуары', name: 'T-Track аксессуары', variant: addonNames.length ? addonNames.join('; ') : 'Базовая комплектация' }
      ];

      const imgUrl = toFullCdnUrl(finish.img);

      if (typeof window.tcart__addProduct === 'function') {
        window.tcart__addProduct({
          name: title,
          price: grandTotal,
          sku: skuInfo ? skuInfo.sku : 'G4N-FOCUS',
          uid: skuInfo ? skuInfo.sku : '1000830012',
          img: imgUrl,
          options: options
        });
        if (typeof window.tcart__openCart === 'function') {
          window.tcart__openCart();
        }
        if (typeof window.geekNookApp.closeModal === 'function') {
          window.geekNookApp.closeModal('configuratorModal');
        }
      } else {
        originalApp.addConfiguredBundleToCart();
      }

      syncTildaCartBadge();
    };

    // --- 6. OVERRIDE: handleB2bSubmit (Tilda CRM & Lead Generation) ---
    window.geekNookApp.handleB2bSubmit = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      
      const company = document.getElementById('b2bCompany')?.value || 'Не указано';
      const email = document.getElementById('b2bEmail')?.value || '';
      const count = document.getElementById('b2bWorkplaces')?.value || '5-10';

      // Check for native hidden Tilda form on page (e.g. BF301)
      const tildaForm = document.querySelector('.t-form, form[name^="form"]');
      if (tildaForm) {
        const inpEmail = tildaForm.querySelector('input[type="email"], input[name="Email"], input[name="email"]');
        const inpCompany = tildaForm.querySelector('input[name="Company"], input[name="company"], input[name="Name"]');
        const inpText = tildaForm.querySelector('textarea, input[name="Comment"], input[name="comment"]');

        if (inpEmail) inpEmail.value = email;
        if (inpCompany) inpCompany.value = company;
        if (inpText) inpText.value = `Запрос КП на ${count} рабочих мест`;

        // Trigger Tilda submit
        const submitBtn = tildaForm.querySelector('button[type="submit"], .t-submit');
        if (submitBtn) {
          submitBtn.click();
        }
      }

      if (typeof window.geekNookApp.closeModal === 'function') {
        window.geekNookApp.closeModal('cadLibraryModal');
      }

      if (typeof window.geekNookApp.showToast === 'function') {
        window.geekNookApp.showToast(`Запрос для «${company}» передан в Tilda CRM! КП отправлено на email.`, 'success');
      } else {
        alert(`Запрос для «${company}» принят! Мы свяжемся с вами по адресу ${email}`);
      }
    };

    // --- 7. CART BADGE SYNC ---
    function syncTildaCartBadge() {
      const badge = document.getElementById('cartBadge');
      if (!badge) return;

      let count = 0;
      if (window.tcart && Array.isArray(window.tcart.products)) {
        count = window.tcart.products.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 1), 0);
      } else if (document.querySelector('.t706__carticon-counter')) {
        count = parseInt(document.querySelector('.t706__carticon-counter').textContent, 10) || 0;
      }

      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    setInterval(syncTildaCartBadge, 800);
    syncTildaCartBadge();

    // --- 8. SMART CDEK PVZ SANITIZER & MAP HELPER ---
    function setupCdekFieldSanitizer() {
      const translitMap = {
        'А': 'A', 'Б': 'B', 'В': 'B', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'ZH', 'З': 'Z',
        'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'H', 'О': 'O', 'П': 'P', 'Р': 'P',
        'С': 'C', 'Т': 'T', 'У': 'Y', 'Ф': 'F', 'Х': 'X', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SHCH',
        'Ы': 'Y', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
      };

      function sanitizeCdekVal(raw) {
        if (!raw) return '';
        let s = raw.toString().toUpperCase().trim();
        let res = '';
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          res += translitMap[ch] || ch;
        }
        return res.replace(/[^A-Z0-9]/g, '').slice(0, 8);
      }

      function attachListenerToCdekInput() {
        const inp = document.querySelector('input[name="Доставка СДЕК"], #input_1790269790207, input[name*="СДЕК"], input[name*="сдек"], input[name*="cdek"], input[name*="CDEK"]');
        if (!inp || inp.dataset.cdekSanitizerAttached) return;

        inp.dataset.cdekSanitizerAttached = 'true';
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('autocapitalize', 'characters');

        inp.addEventListener('input', function() {
          const clean = sanitizeCdekVal(this.value);
          if (this.value !== clean) {
            this.value = clean;
          }
        });

        // Add helper link below input if not already present
        const parent = inp.closest('.t-input-group');
        if (parent && !parent.querySelector('.cdek-map-helper-link')) {
          const helper = document.createElement('div');
          helper.className = 'cdek-map-helper-link';
          helper.style.cssText = 'margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.65); display: flex; align-items: center; gap: 6px;';
          helper.innerHTML = `
            <span>Не знаете код?</span>
            <a href="https://www.cdek.ru/ru/offices" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline; font-weight: 500;">
              Найти свой ПВЗ на карте cdek.ru ↗
            </a>
          `;
          parent.appendChild(helper);
        }
      }

      document.addEventListener('focusin', attachListenerToCdekInput);
      setInterval(attachListenerToCdekInput, 1000);
      attachListenerToCdekInput();
    }

    setupCdekFieldSanitizer();

    // --- 9. ENSURE RUSSIAN BUTTON TEXT ("Оформить заказ") ---
    function ensureRussianButtonText() {
      const texts = document.querySelectorAll('.t706 .t-btnflex__text, .t706 .t-submit, .t-form__submit .t-btnflex__text, .t-form__submit .t-submit');
      texts.forEach(el => {
        if (el.tagName === 'INPUT' && (el.value.toLowerCase().includes('check') || el.value.toLowerCase().includes('order'))) {
          el.value = 'Оформить заказ';
        } else if (el.classList.contains('t-btnflex__text') && (el.textContent.trim().toLowerCase() === 'checkout' || el.textContent.trim().toLowerCase() === 'order')) {
          el.textContent = 'Оформить заказ';
        } else if (el.tagName === 'BUTTON' && !el.querySelector('.t-btnflex__text') && el.textContent.trim().toLowerCase().includes('check')) {
          el.textContent = 'Оформить заказ';
        }
      });
    }
    setInterval(ensureRussianButtonText, 300);
    ensureRussianButtonText();

    // --- 10. SETUP CDEK PAYMENT OPTIONS LABELS ---
    function setupCdekPaymentLabels() {
      const pmGroup = document.querySelector('.t706__orderform .t-input-group_pm, .t-input-group_pm');
      if (!pmGroup) return;

      const labels = pmGroup.querySelectorAll('.t-radio__control');
      if (labels.length >= 2) {
        const r1 = labels[0];
        const r2 = labels[1];

        if (!r1.dataset.cdekRenamed) {
          r1.dataset.cdekRenamed = 'true';
          const indicator = r1.querySelector('.t-radio__indicator');
          const input = r1.querySelector('input');
          r1.innerHTML = '';
          if (input) r1.appendChild(input);
          if (indicator) r1.appendChild(indicator);
          const span = document.createElement('span');
          span.style.cssText = 'color: #ffffff; font-weight: 500; font-size: 13px; line-height: 1.4; display: block;';
          span.innerHTML = '<strong>Оплата в СДЭК при получении</strong><br><span style="color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 400;">Картой или наличными в пункте выдачи после проверки товара</span>';
          r1.appendChild(span);
        }

        if (!r2.dataset.cdekRenamed) {
          r2.dataset.cdekRenamed = 'true';
          const indicator = r2.querySelector('.t-radio__indicator');
          const input = r2.querySelector('input');
          r2.innerHTML = '';
          if (input) r2.appendChild(input);
          if (indicator) r2.appendChild(indicator);
          const span = document.createElement('span');
          span.style.cssText = 'color: #ffffff; font-weight: 500; font-size: 13px; line-height: 1.4; display: block;';
          span.innerHTML = '<strong>Онлайн-оплата через СДЭК</strong><br><span style="color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 400;">По безопасной ссылке СДЭК Pay перед отправкой заказа</span>';
          r2.appendChild(span);
        }
      }
    }
    setInterval(setupCdekPaymentLabels, 400);
    setupCdekPaymentLabels();

    // Export global helper
    window.geekNookTilda = {
      isTildaActive,
      syncBadge: syncTildaCartBadge
    };
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTildaAdapter);
  } else {
    initTildaAdapter();
  }

})();
