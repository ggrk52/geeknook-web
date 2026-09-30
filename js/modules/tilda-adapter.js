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
    if (!window.geekNookApp || typeof window.geekNookApp.openCartDrawer !== 'function') {
      setTimeout(initTildaAdapter, 50);
      return;
    }

    if (!isTildaActive()) {
      console.log('[GeekNook] Tilda environment not detected, using native standalone cart.');
      return;
    }

    console.log('[GeekNook] ⚡ Tilda Headless Adapter activated! Connecting cart & CRM...');

    // SAFELY CAPTURE NATIVE FUNCTIONS BY VALUE TO PREVENT ANY RECURSION
    const nativeAddToCart = window.geekNookApp.addToCart;
    const nativeQuickAddWithFeedback = window.geekNookApp.quickAddWithFeedback;
    const nativeAddFromQuickView = window.geekNookApp.addFromQuickView;
    const nativeOpenCartDrawer = window.geekNookApp.openCartDrawer;
    const nativeOpenQuickBuy = window.geekNookApp.openQuickBuy;
    const nativeAddConfiguredBundleToCart = window.geekNookApp.addConfiguredBundleToCart;
    const nativeHandleCheckoutSubmit = window.geekNookApp.handleCheckoutSubmit;

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

      const hasRealVariants = (p.options && p.options.lengths && p.options.lengths.length) || (opt !== 'Стандарт');
      if (hasRealVariants) {
        itemOptions.push({ option: 'Вариант', name: 'Вариант', variant: opt });
      }

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

      let finalName = p.title;
      if (p.category === 'boards' || hasRealVariants) {
        let woodRu = 'Орех';
        if (p.title.includes('Oak') || p.id.includes('oak')) woodRu = 'Дуб';
        else if (p.title.includes('Black') || p.id.includes('black')) woodRu = 'Черный ясень';
        finalName = `Focus Station ${opt} (${woodRu})`;
      }

      return {
        name: finalName,
        price: resolvedPrice,
        sku: resolvedSku,
        img: toFullCdnUrl(imgPath),
        options: itemOptions
      };
    }

    // Helper: Synchronize Tilda's in-memory cart with GeekNook's cart state
    function syncTildaInMemory() {
      if (!window.tcart) return;
      const cartItems = (window.geekNookApp.state && Array.isArray(window.geekNookApp.state.cart))
        ? window.geekNookApp.state.cart
        : [];

      window.tcart.products = cartItems.map(i => {
        const mapped = mapProductToTilda(i.id, i.option);
        return {
          ...(mapped || { name: i.title, price: i.price }),
          quantity: i.quantity || 1,
          amount: (i.price || 0) * (i.quantity || 1)
        };
      });
      window.tcart.total = cartItems.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
      window.tcart.prodamount = window.tcart.total;
      if (typeof window.tcart__saveLocalObj === 'function') {
        try { window.tcart__saveLocalObj(); } catch(e) {}
      }
    }

    // --- 1. OVERRIDE: addToCart ---
    window.geekNookApp.addToCart = function(productId, optionName = 'Стандарт', openDrawer = false) {
      if (typeof nativeAddToCart === 'function') {
        nativeAddToCart(productId, optionName, openDrawer);
      }
      syncTildaInMemory();
      syncTildaCartBadge();

      // Track Analytics & Ecommerce
      if (window.geekNookAnalytics && typeof window.geekNookAnalytics.trackAddToCart === 'function') {
        const prod = (window.GEEKNOOK_DATA?.allProducts || []).find(p => p.id === productId);
        const item = mapProductToTilda(productId, optionName);
        window.geekNookAnalytics.trackAddToCart({
          sku: item ? (item.sku || item.uid) : productId,
          name: prod ? prod.title : (item ? item.name : productId),
          price: item ? item.price : 0,
          option: optionName,
          quantity: 1
        });
      }
    };

    // --- 2. OVERRIDE: quickAddWithFeedback ---
    window.geekNookApp.quickAddWithFeedback = function(btnEl, productId, optionName = 'Стандарт') {
      if (typeof nativeQuickAddWithFeedback === 'function') {
        nativeQuickAddWithFeedback(btnEl, productId, optionName);
      } else {
        window.geekNookApp.addToCart(productId, optionName, false);
      }
      syncTildaInMemory();
      syncTildaCartBadge();
    };

    // --- 3. OVERRIDE: addFromQuickView ---
    window.geekNookApp.addFromQuickView = function(productId) {
      if (typeof nativeAddFromQuickView === 'function') {
        nativeAddFromQuickView(productId);
      }
      syncTildaInMemory();
      syncTildaCartBadge();
    };

    // --- 4. OVERRIDE: openCartDrawer ---
    window.geekNookApp.openCartDrawer = function() {
      if (typeof nativeOpenCartDrawer === 'function') {
        nativeOpenCartDrawer();
      }
      if (window.geekNookAnalytics && typeof window.geekNookAnalytics.trackCartOpen === 'function') {
        window.geekNookAnalytics.trackCartOpen();
      }
      syncTildaCartBadge();
    };

    // --- 5. OVERRIDE: openQuickBuy ---
    window.geekNookApp.openQuickBuy = function(productId) {
      if (typeof nativeOpenQuickBuy === 'function') {
        nativeOpenQuickBuy(productId);
      }
      syncTildaInMemory();
      syncTildaCartBadge();
    };

    // --- 6. OVERRIDE: addConfiguredBundleToCart ---
    window.geekNookApp.addConfiguredBundleToCart = function() {
      if (typeof nativeAddConfiguredBundleToCart === 'function') {
        nativeAddConfiguredBundleToCart();
      }
      syncTildaInMemory();
      syncTildaCartBadge();
    };

    // --- 7. OVERRIDE: handleCheckoutSubmit (Sync with Tilda CRM, TG & Email in background) ---
    window.geekNookApp.handleCheckoutSubmit = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);

      const name = formData.get('name') || '';
      const phone = formData.get('phone') || '';
      const email = formData.get('email') || '';
      const address = formData.get('address') || '';
      const delivery = formData.get('delivery') || 'СДЭК — пункт выдачи (ПВЗ)';
      const payment = formData.get('payment') || 'Оплата при получении в ПВЗ СДЭК';
      const promo = window.geekNookApp.state?.activePromoCode || '';
      const pvz = window.geekNookApp.state?.selectedPvz;

      // 1. Sync Tilda's background tcart products object
      syncTildaInMemory();

      // 2. Populate Tilda's hidden background order form to trigger Tilda CRM, TG & Email
      const tildaCartForm = document.querySelector('.t706 form, form[name="form3929429901"], .t706__orderform form');
      if (tildaCartForm) {
        const inpName = tildaCartForm.querySelector('input[name="Name"], input[name="name"]');
        const inpEmail = tildaCartForm.querySelector('input[type="email"], input[name="Email"], input[name="email"]');
        const inpPhone = tildaCartForm.querySelector('input[name="Phone"], input[name="phone"]');
        const inpPvz = tildaCartForm.querySelector('input[name="Код ПВЗ СДЭК"], input[name*="ПВЗ"], input[name*="CDEK"], input[name*="cdek"], input[name="Address"], input[name="address"], textarea');
        const inpComment = tildaCartForm.querySelector('textarea, input[name="Comment"], input[name="comment"]');

        if (inpName) inpName.value = name;
        if (inpEmail) inpEmail.value = email;
        if (inpPhone) inpPhone.value = phone;

        const pvzCode = pvz ? pvz.code : (address.match(/\[([A-Z0-9_-]+)\]/i)?.[1] || address);
        const pvzString = pvz ? `ПВЗ СДЭК: [${pvz.code}] ${pvz.address} (${pvz.city})` : address;
        if (inpPvz) inpPvz.value = pvzCode;
        if (inpComment) inpComment.value = `${pvzString}. Доставка: СДЭК (ПВЗ). Оплата: при получении в ПВЗ. ${promo ? 'Промокод: ' + promo : ''}`;

        // Trigger hidden Tilda submit
        const submitBtn = tildaCartForm.querySelector('button[type="submit"], .t-submit');
        if (submitBtn) {
          try { submitBtn.click(); } catch(err) {}
        }
        try {
          const submitEvt = new Event('submit', { bubbles: true, cancelable: true });
          tildaCartForm.dispatchEvent(submitEvt);
        } catch(err) {}
      }

      // 3. Complete checkout in our beautiful UI (shows confirmation modal GN-XXXXXX)
      if (typeof nativeHandleCheckoutSubmit === 'function') {
        nativeHandleCheckoutSubmit(e);
      }
    };

    // --- 8. OVERRIDE: handleB2bSubmit (Tilda CRM & Lead Generation) ---
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

      // Track B2B Lead Goal
      if (window.geekNookAnalytics && typeof window.geekNookAnalytics.trackB2bLead === 'function') {
        window.geekNookAnalytics.trackB2bLead(company, email, count);
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

    // --- 9. INTERCEPT CLICKS ON FLOATING CART ICON ---
    document.addEventListener('click', function(e) {
      const icon = e.target.closest('.t706__carticon, .t706__carticon-wrapper, .t706__carticon-text');
      if (icon) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.geekNookApp.openCartDrawer();
      }
    }, true);

    // --- 10. CART BADGE SYNC ---
    function syncTildaCartBadge() {
      const badge = document.getElementById('cartBadge');
      const mobileBadge = document.getElementById('mobileNavCartCount');
      const t706Counter = document.querySelector('.t706__carticon-counter');
      const t706Icon = document.querySelector('.t706__carticon');

      const cartItems = (window.geekNookApp && window.geekNookApp.state && Array.isArray(window.geekNookApp.state.cart))
        ? window.geekNookApp.state.cart
        : [];
      const count = cartItems.reduce((acc, p) => acc + (parseInt(p.quantity, 10) || 1), 0);

      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
      if (mobileBadge) {
        mobileBadge.textContent = count;
        mobileBadge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
      if (t706Counter) {
        t706Counter.textContent = count;
      }
      if (t706Icon) {
        if (count > 0) {
          t706Icon.classList.add('t706__carticon_showed');
          t706Icon.style.display = 'block';
          t706Icon.style.opacity = '1';
          t706Icon.style.visibility = 'visible';
          t706Icon.style.pointerEvents = 'auto';
        } else {
          t706Icon.classList.remove('t706__carticon_showed');
          t706Icon.style.display = 'none';
          t706Icon.style.opacity = '0';
          t706Icon.style.visibility = 'hidden';
          t706Icon.style.pointerEvents = 'none';
        }
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

  // --- IMMEDIATE TILDA DOM ENHANCEMENTS (Runs independently of geekNookApp) ---
  function initTildaDomEnhancements() {
    // 0. SUPPRESS TILDA AUTO OPEN ON PRODUCT ADD (Keeps catalog browsing uninterrupted)
    function suppressTildaAutoOpen() {
      const t706 = document.querySelector('.t706');
      if (t706 && t706.getAttribute('data-opencart-onorder') === 'yes') {
        t706.setAttribute('data-opencart-onorder', 'no');
      }
    }
    suppressTildaAutoOpen();
    setInterval(suppressTildaAutoOpen, 800);

    // 1. SMART CDEK PVZ SANITIZER & MAP HELPER
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

    function syncTildaOrderPvz(code, fullText) {
      const commentInputs = document.querySelectorAll(
        '.t706__orderform input[name="comments"], .t706__orderform textarea[name="comments"], ' +
        '.t706__orderform input[name="comment"], .t706__orderform textarea[name="comment"]'
      );
      commentInputs.forEach(inp => {
        let curr = inp.value || '';
        curr = curr.replace(/\s*\[ПВЗ СДЭК:.*?\]/g, '').trim();
        if (code) {
          curr = (curr ? curr + ' ' : '') + `[ПВЗ СДЭК: ${code} (${fullText})]`;
        }
        inp.value = curr;
      });
    }

    function openCdekPickerForTilda(onSelected) {
      if (window.geekNookCdekPicker && typeof window.geekNookCdekPicker.open === 'function') {
        window.geekNookCdekPicker.open(onSelected);
        return;
      }

      const base = window.GEEKNOOK_CDN_URL || 'https://ggrk52.github.io/geeknook-web/';
      const cleanBase = base.endsWith('/') ? base : base + '/';

      const s1 = document.createElement('script');
      s1.src = cleanBase + 'js/data/cdek-popular.js?v=' + Date.now();
      document.head.appendChild(s1);

      const s2 = document.createElement('script');
      s2.src = cleanBase + 'js/modules/cdek-picker.js?v=' + Date.now();
      s2.onload = function() {
        if (window.geekNookCdekPicker && typeof window.geekNookCdekPicker.open === 'function') {
          window.geekNookCdekPicker.open(onSelected);
        }
      };
      document.head.appendChild(s2);
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

      const parent = inp.closest('.t-input-group');
      if (parent) {
        const oldLink = parent.querySelector('.cdek-map-helper-link');
        if (oldLink) oldLink.remove();

        if (!parent.querySelector('.cdek-map-helper-wrap')) {
        const helper = document.createElement('div');
        helper.className = 'cdek-map-helper-wrap';
        helper.style.cssText = 'margin-top: 8px; width: 100%; box-sizing: border-box;';
        helper.innerHTML = `
          <button type="button" class="btn-tilda-cdek-picker" style="width: 100%; min-height: 42px; background: #2b70f0; border: none; border-radius: 6px; color: #ffffff; font-size: 13px; font-weight: 600; padding: 8px 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; transition: background 0.2s; box-shadow: 0 2px 8px rgba(43,112,240,0.35);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>Выбрать пункт выдачи СДЭК на карте</span>
          </button>
          <div class="tilda-cdek-selected-box" style="display: none; margin-top: 8px; padding: 10px 12px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); border-radius: 6px; align-items: center; justify-content: space-between;">
            <div style="min-width: 0; padding-right: 8px;">
              <div class="tilda-cdek-selected-code" style="color: #10b981; font-weight: 700; font-family: monospace; font-size: 13px;"></div>
              <div class="tilda-cdek-selected-address" style="color: rgba(255,255,255,0.85); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
            </div>
            <button type="button" class="btn-tilda-cdek-change" style="background: none; border: none; color: #60a5fa; text-decoration: underline; font-size: 12px; font-weight: 600; cursor: pointer; padding: 2px 6px; flex-shrink: 0;">Изменить</button>
          </div>
        `;

        const pickBtn = helper.querySelector('.btn-tilda-cdek-picker');
        const selectedBox = helper.querySelector('.tilda-cdek-selected-box');
        const codeEl = helper.querySelector('.tilda-cdek-selected-code');
        const addrEl = helper.querySelector('.tilda-cdek-selected-address');
        const changeBtn = helper.querySelector('.btn-tilda-cdek-change');

        function handleSelect(point) {
          inp.value = point.code;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));

          if (codeEl) codeEl.textContent = `✓ ПВЗ: ${point.code}`;
          if (addrEl) addrEl.textContent = `${point.city}, ${point.address}`;
          if (selectedBox) selectedBox.style.display = 'flex';
          if (pickBtn) pickBtn.style.display = 'none';

          syncTildaOrderPvz(point.code, `${point.city}, ${point.address}`);
        }

        if (pickBtn) {
          pickBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openCdekPickerForTilda(handleSelect);
          });
        }

        if (changeBtn) {
          changeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openCdekPickerForTilda(handleSelect);
          });
        }

        parent.appendChild(helper);
      }
    }
  }

  // 2. ENSURE RUSSIAN BUTTON TEXT ("Оформить заказ")
    function ensureRussianButtonText() {
      const texts = document.querySelectorAll('.t706 .t-btnflex__text, .t706 .t-submit, .t-form__submit .t-btnflex__text, .t-form__submit .t-submit');
      texts.forEach(el => {
        if (el.tagName === 'INPUT' && (el.value.toLowerCase().includes('check') || el.value.toLowerCase().includes('order'))) {
          el.value = 'Оформить заказ';
        } else if (el.classList.contains('t-btnflex__text') && (el.textContent.trim().toLowerCase() === 'checkout' || el.textContent.trim().toLowerCase() === 'order')) {
          el.textContent = 'Оформить заказ';
        } else if (el.tagName === 'BUTTON' && !el.querySelector('.t-btnflex__text') && (el.textContent.trim().toLowerCase().includes('check') || el.textContent.trim().toLowerCase().includes('order'))) {
          el.textContent = 'Оформить заказ';
        }
      });
    }

    // 3. SETUP CDEK PAYMENT OPTIONS LABELS
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

    // 4. SETUP LEGAL CONSENT NOTICE ABOVE SUBMIT BUTTON
    function setupLegalCartNotice() {
      const form = document.querySelector('.t706__orderform, .t-form__inputsbox');
      if (!form || form.querySelector('.t-cart-legal-notice')) return;
      const submitWrap = form.querySelector('.t-form__submit, .t706__submit');
      if (!submitWrap) return;

      const notice = document.createElement('div');
      notice.className = 't-cart-legal-notice';
      notice.style.cssText = 'font-size: 11.5px; line-height: 1.45; color: rgba(255, 255, 255, 0.55); margin: 12px 0 10px; text-align: center;';
      notice.innerHTML = `Нажимая «Оформить заказ», вы соглашаетесь с <a href="https://geeknook.ru/legal.html#offer" target="_blank" rel="noopener" style="color: #2b70f0; text-decoration: underline;">Публичной офертой</a> и <a href="https://geeknook.ru/legal.html#privacy" target="_blank" rel="noopener" style="color: #2b70f0; text-decoration: underline;">Политикой конфиденциальности</a> ООО «ГИК НУК»`;
      submitWrap.parentNode.insertBefore(notice, submitWrap);
    }

    // 4.1 SETUP PROMO CODE BOX IN TILDA CART
    function setupTildaPromoCodeBox() {
      const cartBottom = document.querySelector('.t706__cartwin-bottom');
      if (!cartBottom || cartBottom.querySelector('.t706-promo-box')) return;

      const promoWrap = document.createElement('div');
      promoWrap.className = 't706-promo-box';
      promoWrap.style.cssText = 'margin: 14px 0; padding: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-family: "Onest", sans-serif;';

      const PROMOS = {
        'DEVTOOLS10': 10,
        'GEEK10': 10,
        'ДАША': 10,
        'DASHA': 10,
        'FOCUS15': 15,
        'WELCOME5': 5
      };

      const savedCode = (localStorage.getItem('geeknook_promo') || '').trim().toUpperCase();
      const isApplied = savedCode && PROMOS[savedCode];

      promoWrap.innerHTML = `
        <div style="font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); margin-bottom: 8px;">
          Промокод на скидку:
        </div>
        <div class="t706-promo-input-row" style="display: ${isApplied ? 'none' : 'flex'}; gap: 8px;">
          <input type="text" class="t706-promo-input" placeholder="Промокод" autocomplete="off" autocorrect="off" autocapitalize="characters" style="flex: 1; min-height: 40px; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; font-size: 13px; text-transform: uppercase;" />
          <button type="button" class="t706-promo-btn" style="min-height: 40px; padding: 0 16px; background: #2b70f0; color: #fff; border: none; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; transition: background 0.2s;">Применить</button>
        </div>
        <div class="t706-promo-applied" style="display: ${isApplied ? 'flex' : 'none'}; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px;">
          <span class="t706-promo-applied-text" style="color: #10b981; font-size: 13px; font-weight: 700; font-family: monospace;">✓ ${isApplied ? `${savedCode} (-${PROMOS[savedCode]}%)` : ''}</span>
          <button type="button" class="t706-promo-remove" style="background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 16px; padding: 2px 8px; line-height: 1;">✕</button>
        </div>
      `;

      const prodAmount = cartBottom.querySelector('.t706__cartwin-prodamount-wrap, .t706__cartwin-prodamount');
      if (prodAmount) {
        cartBottom.insertBefore(promoWrap, prodAmount);
      } else {
        cartBottom.prepend(promoWrap);
      }

      const input = promoWrap.querySelector('.t706-promo-input');
      const btn = promoWrap.querySelector('.t706-promo-btn');
      const row = promoWrap.querySelector('.t706-promo-input-row');
      const appliedBox = promoWrap.querySelector('.t706-promo-applied');
      const appliedText = promoWrap.querySelector('.t706-promo-applied-text');
      const removeBtn = promoWrap.querySelector('.t706-promo-remove');

      function syncTildaOrderComment(code, pct) {
        const commentInputs = document.querySelectorAll('.t706__orderform input[name="comments"], .t706__orderform textarea[name="comments"], .t706__orderform input[name="comment"], .t706__orderform textarea[name="comment"]');
        commentInputs.forEach(inp => {
          let curr = inp.value || '';
          curr = curr.replace(/\s*\[ПРОМОКОД:.*?\]/g, '').trim();
          if (code && pct) {
            curr = (curr ? curr + ' ' : '') + `[ПРОМОКОД: ${code} (-${pct}%)]`;
          }
          inp.value = curr;
        });
      }

      function applyCode() {
        const val = (input.value || '').trim().toUpperCase();
        if (PROMOS[val]) {
          localStorage.setItem('geeknook_promo', val);
          row.style.display = 'none';
          appliedBox.style.display = 'flex';
          appliedText.textContent = `✓ ${val} (-${PROMOS[val]}%)`;
          syncTildaOrderComment(val, PROMOS[val]);
        } else {
          alert('Неверный промокод');
        }
      }

      btn.addEventListener('click', applyCode);
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyCode();
        }
      });

      removeBtn.addEventListener('click', function() {
        localStorage.removeItem('geeknook_promo');
        row.style.display = 'flex';
        appliedBox.style.display = 'none';
        input.value = '';
        syncTildaOrderComment('', 0);
      });

      if (isApplied) {
        syncTildaOrderComment(savedCode, PROMOS[savedCode]);
      }
    }

    // 5. AUTO-SANITIZE EXISTING CART ITEMS (Clears any stale 0-stock catalog collisions from user localStorage)
    function sanitizeExistingCartItems() {
      if (typeof window.tcart !== 'undefined' && window.tcart && Array.isArray(window.tcart.products)) {
        let changed = false;
        window.tcart.products.forEach(item => {
          if (!item || !item.name) return;
          if (item.name === 'Focus Station Oak' || item.name === 'Focus Station Walnut' || item.name === 'Focus Station Black') {
            let opt = '85 см';
            if (Array.isArray(item.options)) {
              const optObj = item.options.find(o => o && (o.option === 'Вариант' || o.name === 'Вариант'));
              if (optObj && optObj.variant) opt = optObj.variant;
            }
            const wood = item.name.replace('Focus Station', '').trim();
            const woodRu = wood === 'Oak' ? 'Дуб' : (wood === 'Black' ? 'Черный ясень' : 'Орех');
            item.name = `Focus Station ${opt} (${woodRu})`;
            if (item.uid) delete item.uid;
            changed = true;
          } else if (item.uid && (item.name.startsWith('Focus Station') || item.sku)) {
            delete item.uid;
            changed = true;
          }
        });

        if (changed) {
          if (typeof window.tcart__saveLocalObj === 'function') window.tcart__saveLocalObj();
          if (typeof window.tcart__reDrawProducts === 'function') window.tcart__reDrawProducts();
          if (typeof window.tcart__reDrawTotal === 'function') window.tcart__reDrawTotal();
          if (typeof window.tcart__reDrawCartIcon === 'function') window.tcart__reDrawCartIcon();
        }
      }
    }

    // 6. AUTO-CLEAR OBSOLETE OUT-OF-STOCK ERROR BANNERS
    function clearOutOfStockErrors() {
      const errBoxes = document.querySelectorAll('.t706 .js-errorbox-all, .t706 .t-form__errorbox-wrapper, .t-form__errorbox-middle .t-form__errorbox-text');
      errBoxes.forEach(b => {
        if (b.textContent && b.textContent.includes('нет в наличии')) {
          b.style.display = 'none';
          if (b.classList.contains('t-form__errorbox-text')) b.innerHTML = '';
          const parentWrap = b.closest('.js-errorbox-all, .t-form__errorbox-wrapper');
          if (parentWrap) parentWrap.style.display = 'none';
        }
      });
    }

    document.addEventListener('focusin', attachListenerToCdekInput);
    setInterval(attachListenerToCdekInput, 800);
    setInterval(ensureRussianButtonText, 300);
    setInterval(setupCdekPaymentLabels, 400);
    setInterval(setupLegalCartNotice, 500);
    setInterval(setupTildaPromoCodeBox, 500);
    setInterval(sanitizeExistingCartItems, 1000);
    setInterval(clearOutOfStockErrors, 600);

    attachListenerToCdekInput();
    ensureRussianButtonText();
    setupCdekPaymentLabels();
    setupLegalCartNotice();
    setupTildaPromoCodeBox();
    sanitizeExistingCartItems();
    clearOutOfStockErrors();
  }

  initTildaDomEnhancements();

  // Auto-init main adapter when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTildaAdapter);
  } else {
    initTildaAdapter();
  }

})();
