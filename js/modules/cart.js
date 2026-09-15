/**
 * GeekNook Module: Cart & Checkout
 * Slide-over cart drawer, quantity controls, promo validation, and Telegram order dispatch.
 */
window.GeekNook = window.GeekNook || {};

  // --- CART SANITIZATION & REPAIR ---
  const sanitizeCart = (raw) => {
    if (!Array.isArray(raw)) return [];
    const sanitizedMap = new Map();
    const dataStore = (typeof GEEKNOOK_DATA !== 'undefined') ? GEEKNOOK_DATA : null;

    raw.forEach(item => {
      if (!item || typeof item !== 'object') return;
      let id = String(item.id || '').trim();
      let title = String(item.title || 'Товар GeekNook').trim();
      let option = String(item.option || 'Стандарт').trim();
      if (!option || option === 'undefined' || option === 'null') option = 'Стандарт';

      // Normalize legacy / duplicate names and IDs (specifically laptop stands from previous versions)
      const lowerTitle = title.toLowerCase();
      const lowerId = id.toLowerCase();
      if ((lowerTitle.includes('laptop') && lowerTitle.includes('open')) || lowerId === 'laptop-open' || lowerId === 'addon-laptop') {
        id = 'laptop-open';
        title = 'Laptop Stand Open';
      } else if ((lowerTitle.includes('laptop') && lowerTitle.includes('closed')) || lowerId === 'laptop-closed' || lowerId === 'addon-vertical-laptop') {
        id = 'laptop-closed';
        title = 'Laptop Stand Closed';
      }

      // Generate guaranteed unique key for this product+option combo
      const cartKey = `${id || title}_${option}`;
      const qty = parseInt(item.quantity, 10);
      const safeQty = (!isNaN(qty) && qty > 0) ? Math.min(99, qty) : 1;
      let price = typeof item.price === 'number' && item.price >= 0 ? item.price : 0;
      let image = item.image;

      // Auto-heal missing price or image from product catalog
      if (dataStore && dataStore.allProducts && id) {
        const found = dataStore.allProducts.find(p => p.id === id);
        if (found) {
          if (!price) price = found.price;
          if (!image) image = found.images[0];
          title = found.title;
        }
      }
      if (!image) {
        image = 'images/tild3763-3337-4662-b233-616531316364__3.jpg';
      }

      if (sanitizedMap.has(cartKey)) {
        // Merge quantities if duplicate exists in storage
        const existing = sanitizedMap.get(cartKey);
        existing.quantity = Math.min(99, existing.quantity + safeQty);
      } else {
        sanitizedMap.set(cartKey, {
          cartKey,
          id: id || 'item',
          title,
          option,
          price,
          image,
          quantity: safeQty
        });
      }
    });

    return Array.from(sanitizedMap.values());
  };

  const loadCart = () => {
    try {
      const stored = JSON.parse(safeStorage.getItem('geeknook_cart') || '[]');
      const clean = sanitizeCart(stored);
      if (JSON.stringify(stored) !== JSON.stringify(clean)) {
        safeStorage.setItem('geeknook_cart', JSON.stringify(clean));
      }
      return clean;
    } catch (e) {
      console.warn('[Defensive] Failed to parse cart from storage, resetting:', e);
      safeStorage.removeItem('geeknook_cart');
      return [];
    }
  };

  // --- CART MANAGEMENT ---
  const addToCart = (productId, optionName = 'Стандарт', openDrawer = true) => {
    if (!productId || typeof productId !== 'string') {
      console.warn('[Defensive] Invalid productId passed to addToCart:', productId);
      return;
    }
    if (!GEEKNOOK_DATA || !Array.isArray(GEEKNOOK_DATA.allProducts)) {
      showToast('Каталог товаров временно недоступен', 'error');
      return;
    }

    const product = GEEKNOOK_DATA.allProducts.find(p => p.id === productId);
    if (!product) {
      console.warn(`[Defensive] Product not found for id: "${productId}"`);
      showToast('Товар не найден в каталоге', 'error');
      return;
    }

    const cleanOption = String(optionName || 'Стандарт').trim();
    const cartKey = `${product.id}_${cleanOption}`;
    const existing = state.cart.find(i => i.cartKey === cartKey);

    if (existing) {
      existing.quantity = Math.min(99, (parseInt(existing.quantity, 10) || 1) + 1);
    } else {
      state.cart.push({
        cartKey,
        id: product.id,
        title: product.title,
        option: cleanOption,
        price: typeof product.price === 'number' ? product.price : 0,
        image: (product.images && product.images[0]) ? product.images[0] : 'images/tild3763-3337-4662-b233-616531316364__3.jpg',
        quantity: 1
      });
    }

    saveCart();
    triggerBadgeBounce();
    soundEngine.play('cart');
    showToast(`«${product.title}» добавлен в корзину!`);
    if (openDrawer) {
      openCartDrawer();
    }
  };

  // Tactile Quick Add with Pop Feedback
  const quickAddWithFeedback = withActionLock((btnEl, productId, optionName = 'Стандарт') => {
    if (!productId || typeof productId !== 'string') return;
    const product = GEEKNOOK_DATA?.allProducts?.find(p => p.id === productId);
    if (!product) {
      showToast('Товар временно отсутствует', 'error');
      return;
    }

    const cleanOption = String(optionName || 'Стандарт').trim();
    const cartKey = `${product.id}_${cleanOption}`;
    const existing = state.cart.find(i => i.cartKey === cartKey);

    if (existing) {
      existing.quantity = Math.min(99, (parseInt(existing.quantity, 10) || 1) + 1);
    } else {
      state.cart.push({
        cartKey,
        id: product.id,
        title: product.title,
        option: cleanOption,
        price: typeof product.price === 'number' ? product.price : 0,
        image: (product.images && product.images[0]) ? product.images[0] : 'images/tild3763-3337-4662-b233-616531316364__3.jpg',
        quantity: 1
      });
    }

    saveCart();
    triggerBadgeBounce();
    soundEngine.play('cart');
    showToast(`«${product.title}» добавлен в корзину!`, 'success');

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
  }, 250);

  const updateCartQuantity = (itemRef, delta) => {
    const safeDelta = parseInt(delta, 10);
    if (isNaN(safeDelta) || safeDelta === 0) return;

    let item = null;
    if (typeof itemRef === 'number') {
      if (itemRef < 0 || itemRef >= state.cart.length) return;
      item = state.cart[itemRef];
    } else if (typeof itemRef === 'string') {
      item = state.cart.find(i => i.cartKey === itemRef || i.id === itemRef);
    }

    if (!item) return;

    const currentQty = parseInt(item.quantity, 10) || 1;
    const newQty = currentQty + safeDelta;

    if (newQty <= 0) {
      const idx = state.cart.indexOf(item);
      if (idx >= 0) {
        state.cart.splice(idx, 1);
      }
    } else {
      item.quantity = Math.min(99, Math.max(1, newQty));
    }
    saveCart();
  };

  const removeCartItem = (itemRef) => {
    let idx = -1;
    if (typeof itemRef === 'number') {
      idx = itemRef;
    } else {
      idx = state.cart.findIndex(i => i.cartKey === itemRef || i.id === itemRef);
    }

    if (idx >= 0 && idx < state.cart.length) {
      const removed = state.cart.splice(idx, 1)[0];
      saveCart();
      if (removed) {
        showToast(`«${removed.title}» удалён из корзины`, 'success');
      }
    }
  };

  const clearCart = () => {
    if (state.cart.length === 0) {
      showToast('Корзина уже пуста');
      return;
    }
    state.cart = [];
    state.promoDiscountPercent = 0;
    state.activePromoCode = '';
    saveCart();
    showToast('Корзина полностью очищена', 'success');
  };

  const updateCartUI = () => {
    const badge = document.getElementById('cartBadge');
    const list = document.getElementById('cartItemsList');
    const subtotalEl = document.getElementById('cartSubtotal');
    const discountEl = document.getElementById('cartDiscount');
    const shippingEl = document.getElementById('cartShipping');
    const grandTotalEl = document.getElementById('cartGrandTotal');
    const progressFill = document.getElementById('shippingProgressBar');
    const progressText = document.getElementById('shippingProgressText');

    const totalCount = state.cart.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
    if (badge) {
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'flex' : 'none';
    }
    const mobileCartBadge = document.getElementById('mobileNavCartCount');
    if (mobileCartBadge) {
      mobileCartBadge.textContent = totalCount;
    }

    const subtotal = state.cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (parseInt(i.quantity, 10) || 0)), 0);
    const discountAmount = Math.round(subtotal * (Math.max(0, Math.min(100, state.promoDiscountPercent)) / 100));
    const isFreeShipping = (subtotal - discountAmount) >= 7000;
    const shippingCost = isFreeShipping ? 0 : (subtotal > 0 ? 490 : 0);
    const grandTotal = Math.max(0, (subtotal - discountAmount) + shippingCost);

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (discountEl) discountEl.textContent = discountAmount > 0 ? `-${formatPrice(discountAmount)}` : '0 ₽';
    if (shippingEl) shippingEl.textContent = isFreeShipping ? 'Бесплатно' : (subtotal > 0 ? '490 ₽' : '0 ₽');
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(grandTotal);

    // Free shipping progress bar
    if (progressFill && progressText) {
      const freeThreshold = 7000;
      const currentNet = Math.max(0, subtotal - discountAmount);
      const pct = Math.min(100, Math.round((currentNet / freeThreshold) * 100));
      progressFill.style.width = `${pct}%`;

      if (pct >= 100) {
        progressText.innerHTML = `<span>✓ Бесплатная доставка активна!</span><span>100%</span>`;
      } else {
        const left = Math.max(0, freeThreshold - currentNet);
        progressText.innerHTML = `<span>До бесплатной доставки: <strong>${formatPrice(left)}</strong></span><span>${pct}%</span>`;
      }
    }

    // Render cart items
    if (list) {
      if (state.cart.length === 0) {
        list.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:var(--text-muted);">
            <div style="margin-bottom:14px;color:var(--text-muted);display:flex;justify-content:center;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <div style="font-weight:700;font-size:1.1rem;margin-bottom:6px;color:var(--text-main);">Ваша корзина пуста</div>
            <p style="font-size:0.875rem;">Добавьте понравившийся товар или соберите комплект в конструкторе!</p>
          </div>
        `;
      } else {
        list.innerHTML = state.cart.map((item, idx) => {
          const safeTitle = escapeHTML(item.title);
          const safeOption = escapeHTML(item.option !== 'Стандарт' ? item.option : '');
          const safeQty = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));
          const safeItemTotal = (Number(item.price) || 0) * safeQty;

          return `
            <div class="cart-item-row">
              <img class="cart-item-thumb" src="${item.image}" alt="${safeTitle}" onerror="this.onerror=null;this.src='images/tild3763-3337-4662-b233-616531316364__3.jpg'" />
              <div class="cart-item-info">
                <div class="cart-item-top">
                  <div class="cart-item-title">${safeTitle}</div>
                  <button class="cart-item-remove-btn" onclick="window.geekNookApp.removeCartItem(${idx})" title="Удалить товар" aria-label="Удалить товар">✕</button>
                </div>
                <div class="cart-item-opt">${safeOption}</div>
                <div class="cart-item-bottom">
                  <div class="qty-control">
                    <button class="qty-btn" onclick="window.geekNookApp.updateCartQuantity(${idx}, -1)" aria-label="Уменьшить">−</button>
                    <span class="qty-val">${safeQty}</span>
                    <button class="qty-btn" onclick="window.geekNookApp.updateCartQuantity(${idx}, 1)" aria-label="Увеличить">+</button>
                  </div>
                  <div class="cart-item-price">${formatPrice(safeItemTotal)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  };

  const openCartDrawer = () => {
    const drawer = document.getElementById('cartDrawerOverlay');
    if (drawer) {
      drawer.classList.add('active');
      modalManager.syncOverflow();
    }
  };

  const closeCartDrawer = () => {
    const drawer = document.getElementById('cartDrawerOverlay');
    if (drawer) {
      drawer.classList.remove('active');
      modalManager.syncOverflow();
    }
  };

  const openMobileNav = () => {
    const nav = document.getElementById('mobileNavOverlay');
    if (nav) {
      nav.classList.add('active');
      modalManager.syncOverflow();
      const mobileCartBadge = document.getElementById('mobileNavCartCount');
      if (mobileCartBadge) {
        mobileCartBadge.textContent = state.cart.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
      }
    }
  };

  const closeMobileNav = () => {
    const nav = document.getElementById('mobileNavOverlay');
    if (nav) {
      nav.classList.remove('active');
      modalManager.syncOverflow();
    }
  };

  const applyPromoCode = () => {
    const input = document.getElementById('promoInput');
    if (!input) return;
    const code = input.value.trim().toUpperCase();

    if (code === 'GEEK10' || code === 'ДАША' || code === 'DASHA' || code === 'DEVTOOLS10') {
      state.promoDiscountPercent = 10;
      state.activePromoCode = code;
      saveCart();
      showToast('Промокод применён: скидка 10%!', 'success');
    } else {
      showToast('Неверный промокод', 'error');
    }
  };

  // --- CHECKOUT PROCESS ---
  const openCheckout = () => {
    if (state.cart.length === 0) {
      showToast('Корзина пуста', 'error');
      return;
    }

    closeCartDrawer();
    const summaryList = document.getElementById('checkoutItemsSummary');
    const summaryTotal = document.getElementById('checkoutGrandTotalSummary');

    if (summaryList) {
      summaryList.innerHTML = state.cart.map(i => {
        const safeTitle = escapeHTML(i.title);
        const safeQty = Math.max(1, Math.min(99, parseInt(i.quantity, 10) || 1));
        const safeTotal = (Number(i.price) || 0) * safeQty;
        return `
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.875rem;">
            <span style="color:var(--text-muted);">${safeTitle} × ${safeQty}</span>
            <span style="font-weight:600;">${formatPrice(safeTotal)}</span>
          </div>
        `;
      }).join('');
    }

    const subtotal = state.cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (parseInt(i.quantity, 10) || 1)), 0);
    const discountAmount = Math.round(subtotal * (Math.max(0, Math.min(100, state.promoDiscountPercent)) / 100));
    const isFreeShipping = (subtotal - discountAmount) >= 7000;
    const shippingCost = isFreeShipping ? 0 : 490;
    const grandTotal = Math.max(0, (subtotal - discountAmount) + shippingCost);

    if (summaryTotal) summaryTotal.textContent = formatPrice(grandTotal);

    modalManager.open('checkoutModal');
  };

  const handleCheckoutSubmit = withActionLock((e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const safeName = escapeHTML(formData.get('name') || 'Покупатель');
    const safePhone = escapeHTML(formData.get('phone') || '');
    const safeAddress = escapeHTML(formData.get('address') || 'Самовывоз');
    const safeDelivery = escapeHTML(formData.get('delivery') || 'СДЭК');
    const safePayment = escapeHTML(formData.get('payment') || 'При получении');

    const orderNumber = 'GN-' + Math.floor(100000 + Math.random() * 900000);
    const subtotal = state.cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (parseInt(i.quantity, 10) || 1)), 0);
    const discountAmount = Math.round(subtotal * (Math.max(0, Math.min(100, state.promoDiscountPercent)) / 100));
    const isFreeShipping = (subtotal - discountAmount) >= 7000;
    const shippingCost = isFreeShipping ? 0 : 490;
    const grandTotal = Math.max(0, (subtotal - discountAmount) + shippingCost);

    const detailsEl = document.getElementById('successOrderDetails');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div style="margin-bottom:8px;"><strong>Номер заказа:</strong> #${orderNumber}</div>
        <div style="margin-bottom:8px;"><strong>Получатель:</strong> ${safeName} (${safePhone})</div>
        <div style="margin-bottom:8px;"><strong>Адрес доставки:</strong> ${safeAddress}</div>
        <div style="margin-bottom:8px;"><strong>Способ доставки:</strong> ${safeDelivery}</div>
        <div style="margin-bottom:8px;"><strong>Способ оплаты:</strong> ${safePayment}</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border);font-weight:800;font-size:1.1rem;color:var(--primary);">
          Сумма к оплате: ${formatPrice(grandTotal)}
        </div>
      `;
    }

    // Reset Cart
    state.cart = [];
    state.promoDiscountPercent = 0;
    state.activePromoCode = '';
    saveCart();

    modalManager.close('checkoutModal');
    modalManager.open('successModal');
  }, 400);

  // --- 1-CLICK QUICK BUY ---
  const openQuickBuy = (productId) => {
    const product = GEEKNOOK_DATA?.allProducts?.find(p => p.id === productId);
    if (!product) return;
    state.quickBuyProduct = product;

    // Check if quick view is open and has an active option
    const qvModal = document.getElementById('quickViewModal');
    let chosenOption = 'Стандарт';
    if (qvModal && qvModal.classList.contains('active')) {
      const activeChip = qvModal.querySelector('.option-chip.active');
      if (activeChip) chosenOption = activeChip.getAttribute('data-val') || 'Стандарт';
      modalManager.close('quickViewModal');
    }
    state.quickBuyProductOption = chosenOption;

    const summaryEl = document.getElementById('quickBuyProductSummary');
    if (summaryEl) {
      const safeTitle = escapeHTML(product.title);
      const safeOpt = escapeHTML(chosenOption !== 'Стандарт' ? `(${chosenOption})` : '');
      summaryEl.innerHTML = `
        <img class="quick-buy-prod-img" src="${product.images[0]}" alt="${safeTitle}" onerror="this.onerror=null;this.src='images/tild3763-3337-4662-b233-616531316364__3.jpg'" />
        <div>
          <div class="quick-buy-prod-title">${safeTitle} ${safeOpt}</div>
          <div class="quick-buy-prod-price">${formatPrice(product.price)}</div>
        </div>
      `;
    }

    modalManager.open('quickBuyModal');
  };

  const handleQuickBuySubmit = withActionLock((e) => {
    e.preventDefault();
    const nameInput = document.getElementById('quickBuyName');
    const phoneInput = document.getElementById('quickBuyPhone');
    const safeName = escapeHTML(nameInput ? nameInput.value.trim() : 'Покупатель');
    const safePhone = escapeHTML(phoneInput ? phoneInput.value.trim() : '');
    const prod = state.quickBuyProduct;
    if (!prod) return;

    const safeTitle = escapeHTML(prod.title);
    const safeOpt = escapeHTML(state.quickBuyProductOption !== 'Стандарт' ? `(${state.quickBuyProductOption})` : '');
    const orderNumber = 'GN-1C-' + Math.floor(100000 + Math.random() * 900000);
    modalManager.close('quickBuyModal');

    const detailsEl = document.getElementById('successOrderDetails');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div style="margin-bottom:8px;"><strong>Тип заказа:</strong> Быстрый заказ в 1 клик</div>
        <div style="margin-bottom:8px;"><strong>Номер заказа:</strong> #${orderNumber}</div>
        <div style="margin-bottom:8px;"><strong>Контактное лицо:</strong> ${safeName} (${safePhone})</div>
        <div style="margin-bottom:8px;"><strong>Товар:</strong> ${safeTitle} ${safeOpt}</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border);font-weight:800;font-size:1.1rem;color:var(--primary);">
          Сумма: ${formatPrice(prod.price)}
        </div>
      `;
    }

    modalManager.open('successModal');
    showToast('Быстрый заказ оформлен! Менеджер перезвонит вам.', 'success');
  }, 400);

  const quickBuyViaTelegram = () => {
    const prod = state.quickBuyProduct;
    if (!prod) return;
    const optText = state.quickBuyProductOption && state.quickBuyProductOption !== 'Стандарт' ? ` (${state.quickBuyProductOption})` : '';
    const text = `Здравствуйте! Хочу оформить быстрый заказ в 1 клик на GeekNook:\n\nТовар: ${prod.title}${optText}\nСтоимость: ${formatPrice(prod.price)}\n\nСвяжитесь со мной для подтверждения адреса доставки!`;
    window.open(`https://t.me/geeknook?text=${encodeURIComponent(text)}`, '_blank');
    modalManager.close('quickBuyModal');
  };

  // --- TELEGRAM CHECKOUT ---
  const orderViaTelegram = () => {
    if (state.cart.length === 0) {
      showToast('Корзина пуста', 'error');
      return;
    }
    const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const discountAmount = Math.round(subtotal * (state.promoDiscountPercent / 100));
    const isFreeShipping = (subtotal - discountAmount) >= 7000;
    const shippingCost = isFreeShipping ? 0 : 490;
    const grandTotal = (subtotal - discountAmount) + shippingCost;

    let msg = `Здравствуйте! Хочу оформить заказ в GeekNook:\n\n`;
    state.cart.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.title} ${item.option !== 'Стандарт' ? `[${item.option}]` : ''} × ${item.quantity} шт. = ${formatPrice(item.price * item.quantity)}\n`;
    });
    if (discountAmount > 0) {
      msg += `\nСкидка (${state.activePromoCode}): -${formatPrice(discountAmount)}`;
    }
    msg += `\nДоставка СДЭК: ${isFreeShipping ? 'Бесплатно' : formatPrice(shippingCost)}`;
    msg += `\nИтого к оплате: ${formatPrice(grandTotal)}\n\nЖду подтверждения заказа!`;

    window.open(`https://t.me/geeknook?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const orderConfigViaTelegram = () => {
    const finish = GEEKNOOK_DATA.configurator.finishes.find(f => f.id === state.config.finishId);
    const length = GEEKNOOK_DATA.configurator.lengths.find(l => l.id === state.config.lengthId);
    const addons = state.config.selectedAddonIds.map(id => GEEKNOOK_DATA.configurator.addons.find(a => a.id === id)).filter(Boolean);

    const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
    const grandTotal = length.priceBase + finish.priceDelta + addonsTotal;

    let msg = `Здравствуйте! Собрал кастомный сетап в 3D-конфигураторе GeekNook:\n\n`;
    msg += `• Основание: Focus Station (${length.id} см)\n`;
    msg += `• Отделка: ${finish.name}\n`;
    if (addons.length > 0) {
      msg += `• Модули T-Track:\n`;
      addons.forEach(a => {
        msg += `  - ${a.name} (+${formatPrice(a.price)})\n`;
      });
    } else {
      msg += `• Модули: Базовая комплектация\n`;
    }
    msg += `\nИтоговая стоимость: ${formatPrice(grandTotal)} (Доставка бесплатно)\n\nХочу оформить заказ на эту сборку!`;

    window.open(`https://t.me/geeknook?text=${encodeURIComponent(msg)}`, '_blank');
  };


window.GeekNook.cart = {
  loadCart,
  openCartDrawer,
  closeCartDrawer,
  addToCart,
  quickAddWithFeedback,
  updateCartQuantity,
  removeCartItem,
  clearCart,
  updateCartUI,
  applyPromoCode,
  openCheckout,
  handleCheckoutSubmit,
  openQuickBuy,
  handleQuickBuySubmit,
  quickBuyViaTelegram,
  orderViaTelegram,
  orderConfigViaTelegram
};
