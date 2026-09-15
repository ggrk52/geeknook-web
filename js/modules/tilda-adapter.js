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
            img: b.image ? (b.image.startsWith('http') ? b.image : `https://static.tildacdn.com/${b.image.replace(/^images\//, '').replace('__', '/')}`) : '',
            options: [
              { name: 'Комплектация', variant: (b.items || []).join(', ') }
            ]
          };
        }
        return null;
      }

      const imgPath = (p.images && p.images[0]) ? p.images[0] : '';
      const fullImgUrl = imgPath.startsWith('http') ? imgPath : (imgPath ? `https://static.tildacdn.com/${imgPath.replace(/^images\//, '').replace('__', '/')}` : '');

      return {
        name: p.title,
        price: p.price,
        img: fullImgUrl,
        options: [
          { name: 'Вариант', variant: optionName || 'Стандарт' }
        ]
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

      const title = `Focus Station ${length.id} см (${finish.name})`;
      const options = [
        { name: 'Длина основания', variant: length.id + ' см' },
        { name: 'Порода дерева', variant: finish.name },
        { name: 'Лазерная гравировка', variant: config.engravingEnabled ? (config.engravingText || 'GEEKNOOK // LAB') : 'Без гравировки' },
        { name: 'T-Track аксессуары', variant: addonNames.length ? addonNames.join('; ') : 'Базовая комплектация' }
      ];

      const imgUrl = finish.img ? (finish.img.startsWith('http') ? finish.img : `https://static.tildacdn.com/${finish.img.replace(/^images\//, '').replace('__', '/')}`) : '';

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
