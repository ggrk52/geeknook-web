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
          return {
            name: b.title,
            price: b.price,
            img: toFullCdnUrl(b.image),
            options: [
              { name: 'Комплектация', variant: (b.items || []).join(', ') }
            ]
          };
        }
        return null;
      }

      const imgPath = (p.images && p.images[0]) ? p.images[0] : (p.image || '');
      const opt = optionName || 'Стандарт';
      let resolvedPrice = p.price;
      if (p.optionPrices && p.optionPrices[opt]) {
        resolvedPrice = p.optionPrices[opt];
      }

      const itemOptions = [
        { name: 'Вариант', variant: opt }
      ];

      // If product has warehouse SKU definitions for this option, attach them for CRM & 1C
      if (p.skus && p.skus[opt]) {
        const skuInfo = p.skus[opt];
        itemOptions.push({ name: 'Габариты', variant: skuInfo.dimensions });
        itemOptions.push({ name: 'Артикул', variant: skuInfo.part });
        itemOptions.push({ name: 'SKU', variant: skuInfo.sku });
      }

      return {
        name: p.title,
        price: resolvedPrice,
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
    };

    // --- 3. OVERRIDE: openCartDrawer ---
    window.geekNookApp.openCartDrawer = function() {
      if (typeof window.tcart__openCart === 'function') {
        window.tcart__openCart();
      } else {
        originalApp.openCartDrawer();
      }
      syncTildaCartBadge();
    };

    // --- 4. OVERRIDE: openCheckout / QuickBuy ---
    window.geekNookApp.openQuickBuy = function(productId) {
      window.geekNookApp.addToCart(productId, 'Стандарт', true);
    };

    // --- 5. OVERRIDE: addConfiguredBundleToCart (Focus Station 3D Configurator) ---
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
        { name: 'Длина основания', variant: length.id + ' см' },
        { name: 'Габариты', variant: skuInfo ? skuInfo.dimensions : `${length.id} × 9 × 23 см` },
        { name: 'Порода дерева', variant: finish.name },
        { name: 'Артикул', variant: skuInfo ? skuInfo.part : 'G4N-FOCUS' },
        { name: 'SKU', variant: skuInfo ? skuInfo.sku : '' },
        { name: 'Лазерная гравировка', variant: config.engravingEnabled ? (config.engravingText || 'GEEKNOOK // LAB') : 'Без гравировки' },
        { name: 'T-Track аксессуары', variant: addonNames.length ? addonNames.join('; ') : 'Базовая комплектация' }
      ];

      const imgUrl = toFullCdnUrl(finish.img);

      if (typeof window.tcart__addProduct === 'function') {
        window.tcart__addProduct({
          name: title,
          price: grandTotal,
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
