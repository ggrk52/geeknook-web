/**
 * GeekNook Modern Application Script
 * Implements fluid 60fps animations, interactive workbench configurator,
 * quick-add micro-interactions, full editorial journal reader, and slide-over cart.
 */

(() => {
  'use strict';

  // --- DEFENSIVE SAFE STORAGE (Private Browsing & Quota Fallback) ---
  const safeStorage = {
    _memory: {},
    getItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = window.localStorage.getItem(key);
          if (val !== null) return val;
        }
      } catch (e) {
        console.warn('[SafeStorage] Storage read failed, using memory fallback:', e);
      }
      return Object.prototype.hasOwnProperty.call(this._memory, key) ? this._memory[key] : null;
    },
    setItem(key, value) {
      const strVal = String(value);
      this._memory[key] = strVal;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, strVal);
        }
      } catch (e) {
        console.warn('[SafeStorage] Storage write failed (quota exceeded or private mode):', e);
      }
    },
    removeItem(key) {
      delete this._memory[key];
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) {}
    }
  };

  // --- DEFENSIVE INPUT SANITIZER (XSS Prevention) ---
  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // --- CDN ASSET RESOLVER ---
  const toAssetUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    const base = (typeof window !== 'undefined' && window.GEEKNOOK_CDN_URL) || 'https://ggrk52.github.io/geeknook-web/';
    const clean = url.replace(/^\.?\//, '');
    return base.endsWith('/') ? base + clean : base + '/' + clean;
  };

  // --- DEFENSIVE MODAL & SCROLL-LOCK MANAGER ---
  const modalManager = {
    activeModals: new Set(),
    open(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.warn(`[ModalManager] Modal not found: #${modalId}`);
        return;
      }
      modal.classList.add('active');
      this.activeModals.add(modalId);
      this.syncOverflow();

      if (modalId === 'configuratorModal' && typeof focusStation3DStudio !== 'undefined' && focusStation3DStudio.start) {
        const wrap3d = document.getElementById('config3dViewport');
        if (wrap3d && wrap3d.style.display !== 'none') {
          focusStation3DStudio.start();
        }
      }
    },
    close(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
        if (document.activeElement && modal.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }
      this.activeModals.delete(modalId);
      this.syncOverflow();

      if (modalId === 'configuratorModal' && typeof focusStation3DStudio !== 'undefined' && focusStation3DStudio.stop) {
        focusStation3DStudio.stop();
      }
    },
    closeAll() {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      document.querySelectorAll('.modal-backdrop.active, .cart-drawer-overlay.active, .mobile-nav-overlay.active').forEach(m => {
        m.classList.remove('active');
      });
      this.activeModals.clear();
      this.syncOverflow();

      if (typeof focusStation3DStudio !== 'undefined' && focusStation3DStudio.stop) {
        focusStation3DStudio.stop();
      }
    },
    syncOverflow() {
      const anyActive = document.querySelectorAll('.modal-backdrop.active, .cart-drawer-overlay.active, .mobile-nav-overlay.active').length > 0;
      if (anyActive || this.activeModals.size > 0) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  };

  // --- SUBMIT / ACTION LOCK (Debounce helper) ---
  let isActionLocked = false;
  const withActionLock = (fn, delay = 350) => {
    return function(...args) {
      if (isActionLocked) return;
      isActionLocked = true;
      try {
        return fn.apply(this, args);
      } finally {
        setTimeout(() => { isActionLocked = false; }, delay);
      }
    };
  };

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

  // --- APPLICATION STATE ---
  const state = {
    cart: loadCart(),
    promoDiscountPercent: 0,
    activePromoCode: '',
    config: {
      finishId: 'black',
      lengthId: '85',
      selectedAddonIds: ['addon-headphones', 'addon-phone'],
      engravingEnabled: false,
      engravingText: 'GEEKNOOK // LAB'
    },
    quickBuyProduct: null,
    quickBuyProductOption: 'Стандарт',
    activeLegalTab: 'delivery',
    quiz: {
      step: 1,
      answers: {
        setupType: null,
        laptopUsage: null,
        focusPriority: null
      }
    },
    quizBundle: null
  };

  // --- DEFENSIVE FORMATTING HELPERS ---
  const formatPrice = (num) => {
    const val = Number(num);
    const safeNum = (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0)
      ? Math.round(val)
      : 0;
    return new Intl.NumberFormat('ru-RU').format(safeNum) + ' ₽';
  };

  // --- CART PERSISTENCE & TOASTS ---
  const saveCart = () => {
    try {
      safeStorage.setItem('geeknook_cart', JSON.stringify(state.cart));
    } catch (e) {
      console.warn('[Defensive] saveCart failed:', e);
    }
    updateCartUI();
  };

  const triggerBadgeBounce = () => {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    badge.classList.remove('pop-bounce');
    void badge.offsetWidth;
    badge.classList.add('pop-bounce');
  };

  const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const iconSvg = type === 'error'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    toast.innerHTML = `<span style="display:inline-flex;align-items:center;">${iconSvg}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  };

  // --- SOUND ENGINE (Micro-Haptics Web Audio API) ---
  const SOUND_STORAGE_KEY = 'geeknook_sound_enabled';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = safeStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    }

    initContext() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    play(type = 'click') {
      if (!this.enabled) return;
      try {
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'click') {
          // Subtle mechanical tactile tick
          osc.type = 'sine';
          osc.frequency.setValueAtTime(750, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
          osc.start(now);
          osc.stop(now + 0.035);
        } else if (type === 'snap') {
          // Crisp mechanical magnetic snap + low thud
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        } else if (type === 'whoosh') {
          // Soft atmospheric whoosh
          osc.type = 'sine';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === 'cart') {
          // Melodic harmonic chime
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.05);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          osc.start(now);
          osc.stop(now + 0.16);
        } else if (type === 'toggle') {
          // Smooth toggle blip
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
        }
      } catch (e) {
        // Silent fallback
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      safeStorage.setItem(SOUND_STORAGE_KEY, this.enabled ? 'true' : 'false');
      this.updateButtonUI();
      if (this.enabled) {
        this.play('toggle');
        showToast('Тактильный звук включен');
      } else {
        showToast('Звук выключен');
      }
      return this.enabled;
    }

    updateButtonUI() {
      const btn = document.getElementById('soundToggleBtn');
      if (!btn) return;
      if (this.enabled) {
        btn.classList.remove('sound-muted');
        btn.title = 'Тактильный звук включен (S)';
        const iconOn = btn.querySelector('.sound-icon-on');
        const iconOff = btn.querySelector('.sound-icon-off');
        if (iconOn) iconOn.style.display = 'block';
        if (iconOff) iconOff.style.display = 'none';
      } else {
        btn.classList.add('sound-muted');
        btn.title = 'Тактильный звук выключен (S)';
        const iconOn = btn.querySelector('.sound-icon-on');
        const iconOff = btn.querySelector('.sound-icon-off');
        if (iconOn) iconOn.style.display = 'none';
        if (iconOff) iconOff.style.display = 'block';
      }
    }
  }

  const soundEngine = new SoundEngine();
  const toggleSound = () => soundEngine.toggle();

  // --- THEME MANAGER (Dark / Light Mode) ---
  const THEME_STORAGE_KEY = 'geeknook_theme';

  const themeManager = {
    currentTheme: 'light',

    init() {
      const saved = safeStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        this.currentTheme = saved;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.currentTheme = 'dark';
      } else {
        this.currentTheme = 'light';
      }

      this.applyTheme(this.currentTheme, false);
      soundEngine.updateButtonUI();

      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          const userSaved = safeStorage.getItem(THEME_STORAGE_KEY);
          if (!userSaved) {
            this.applyTheme(e.matches ? 'dark' : 'light', false);
          }
        });
      }

      // Global keyboard shortcuts ('T' for theme, 'S' for sound when not in inputs)
      window.addEventListener('keydown', (e) => {
        const target = e.target;
        const isInput = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        );
        if (isInput) return;

        if (e.key === 't' || e.key === 'T') {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          this.toggleTheme(true);
        } else if (e.key === 's' || e.key === 'S') {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          soundEngine.toggle();
        }
      });
    },

    applyTheme(theme, showToastNotification = false) {
      this.currentTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this.currentTheme);
      safeStorage.setItem(THEME_STORAGE_KEY, this.currentTheme);

      const mobileCheckbox = document.getElementById('mobileThemeCheckbox');
      if (mobileCheckbox) {
        mobileCheckbox.checked = (this.currentTheme === 'dark');
      }

      const desktopBtn = document.getElementById('themeToggleBtn');
      if (desktopBtn) {
        const isDark = this.currentTheme === 'dark';
        desktopBtn.title = isDark ? 'Включить светлую тему (T)' : 'Включить тёмную тему (T)';
        desktopBtn.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
      }

      if (showToastNotification && typeof showToast === 'function') {
        soundEngine.play('toggle');
        if (this.currentTheme === 'dark') {
          showToast('Тёмная тема включена');
        } else {
          showToast('Светлая тема включена');
        }
      }
    },

    toggleTheme(showToastNotification = true) {
      const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme, showToastNotification);
      return nextTheme;
    }
  };

  const toggleTheme = (showToast = true) => themeManager.toggleTheme(showToast);
  const setTheme = (theme, showToast = true) => themeManager.applyTheme(theme, showToast);
  const getTheme = () => themeManager.currentTheme;

  // --- HEADER SCROLL DYNAMICS ---
  const initHeaderScroll = () => {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    let ticking = false;
    const checkScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const isScrolled = window.scrollY > 40;
          if (header.classList.contains('scrolled') !== isScrolled) {
            header.classList.toggle('scrolled', isScrolled);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
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

    let cleanOption = String(optionName || 'Стандарт').trim();
    if (cleanOption === 'Стандарт' && product.options && product.options.lengths && product.options.lengths.length) {
      cleanOption = product.options.lengths[0];
    }
    const cartKey = `${product.id}_${cleanOption}`;
    const existing = state.cart.find(i => i.cartKey === cartKey);

    let finalPrice = typeof product.price === 'number' ? product.price : 0;
    if (product.optionPrices && product.optionPrices[cleanOption]) {
      finalPrice = product.optionPrices[cleanOption];
    }

    if (existing) {
      existing.quantity = Math.min(99, (parseInt(existing.quantity, 10) || 1) + 1);
    } else {
      state.cart.push({
        cartKey,
        id: product.id,
        title: product.title,
        option: cleanOption,
        price: finalPrice,
        image: (product.images && product.images[0]) ? product.images[0] : 'images/tild3763-3337-4662-b233-616531316364__3.jpg',
        quantity: 1
      });
    }

    saveCart();
    triggerBadgeBounce();
    soundEngine.play('cart');
    showToast(`«${product.title} (${cleanOption})» добавлен в корзину!`);
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

    let cleanOption = String(optionName || 'Стандарт').trim();
    if (cleanOption === 'Стандарт' && product.options && product.options.lengths && product.options.lengths.length) {
      cleanOption = product.options.lengths[0];
    }
    const cartKey = `${product.id}_${cleanOption}`;
    const existing = state.cart.find(i => i.cartKey === cartKey);

    let finalPrice = typeof product.price === 'number' ? product.price : 0;
    if (product.optionPrices && product.optionPrices[cleanOption]) {
      finalPrice = product.optionPrices[cleanOption];
    }

    if (existing) {
      existing.quantity = Math.min(99, (parseInt(existing.quantity, 10) || 1) + 1);
    } else {
      state.cart.push({
        cartKey,
        id: product.id,
        title: product.title,
        option: cleanOption,
        price: finalPrice,
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
              <img class="cart-item-thumb" src="${toAssetUrl(item.image)}" alt="${safeTitle}" onerror="this.onerror=null;this.src=toAssetUrl('images/tild3763-3337-4662-b233-616531316364__3.jpg')" />
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

  // --- PRODUCT CARD COMPONENT ---
  const renderProductCard = (p, idx = 0) => {
    const badgeHtml = p.badge ? `<span class="card-badge">${p.badge}</span>` : '';
    const oldPriceHtml = p.oldPrice ? `<span class="old-price">${formatPrice(p.oldPrice)}</span>` : '';
    const materialTag = p.materials ? p.materials.split(',')[0].trim() : 'Инженерный массив';
    const hasHoverImg = p.images && p.images.length > 1;
    const mainImg = toAssetUrl(p.images && p.images[0] ? p.images[0] : (p.image || ''));
    const hoverImg = hasHoverImg ? toAssetUrl(p.images[1]) : '';

    return `
      <div class="product-item-card reveal-card" style="--stagger-delay: ${(idx % 4) * 0.08}s;" data-product-id="${p.id}">
        <div class="card-spotlight"></div>
        <div class="product-img-box" onclick="window.geekNookApp.openQuickView('${p.id}')">
          ${badgeHtml}
          <img class="card-img-main" src="${mainImg}" alt="${p.title}" loading="lazy" decoding="async" />
          ${hasHoverImg ? `<img class="card-img-hover" src="${hoverImg}" alt="${p.title}" loading="lazy" decoding="async" />` : ''}
          <div class="card-floating-glass-bar" onclick="event.stopPropagation();">
            <button class="glass-action-btn quick-view-btn" onclick="window.geekNookApp.openQuickView('${p.id}')" title="Быстрый просмотр">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span>Обзор</span>
            </button>
            <button class="glass-action-btn quick-add-btn" onclick="window.geekNookApp.quickAddWithFeedback(this, '${p.id}');" title="Добавить в корзину">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>В корзину</span>
            </button>
          </div>
        </div>
        <div class="card-meta-tag">${materialTag}${p.options && p.options.lengths ? ' • 2 размера: 85 и 116 см' : ''}</div>
        <h4 class="product-card-title" onclick="window.geekNookApp.openQuickView('${p.id}')">${p.title}</h4>
        <div class="product-card-sub">${p.subtitle || p.shortDescr || ''}</div>
        <div class="product-card-price">
          <span class="price-current">${p.options && p.options.lengths ? `от ${formatPrice(p.price)}` : formatPrice(p.price)}</span>
          ${oldPriceHtml}
        </div>
        <div class="card-actions-row">
          <button class="btn-card-details" onclick="window.geekNookApp.openQuickView('${p.id}')">
            <span>Подробнее</span>
          </button>
          <button class="btn-card-quick-add" onclick="window.geekNookApp.quickAddWithFeedback(this, '${p.id}'); event.stopPropagation();" title="Добавить в корзину">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  };

  // --- CATALOG RENDERERS ---
  const renderBoards = () => {
    const wrap = document.getElementById('boardsGrid');
    if (!wrap) return;
    wrap.innerHTML = GEEKNOOK_DATA.boards.map((p, idx) => renderProductCard(p, idx)).join('');
  };

  const renderAccessories = () => {
    const wrap = document.getElementById('accessoriesGrid');
    if (!wrap) return;
    // Show all 8 verified accessories in two clean 4-column rows
    wrap.innerHTML = GEEKNOOK_DATA.accessories.map((p, idx) => renderProductCard(p, idx)).join('');
  };

  const renderMats = () => {
    const wrap = document.getElementById('matsGrid');
    if (!wrap) return;
    wrap.innerHTML = GEEKNOOK_DATA.mats.map((p, idx) => renderProductCard(p, idx)).join('');
  };

  // --- SUBTLE 3D TILT & MAGNETIC SPOTLIGHT INTERACTION (Option 2) ---
  const initCardTiltInteraction = () => {
    if (typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return;
    }

    const gridIds = ['boardsGrid', 'accessoriesGrid', 'matsGrid'];

    gridIds.forEach((gridId) => {
      const grid = document.getElementById(gridId);
      if (!grid) return;

      let activeCard = null;
      let cardRect = null;
      let rafId = null;
      let targetRotX = 0;
      let targetRotY = 0;
      let curRotX = 0;
      let curRotY = 0;
      let mouseXPct = 50;
      let mouseYPct = 50;

      const animateTilt = () => {
        if (!activeCard) return;

        curRotX += (targetRotX - curRotX) * 0.14;
        curRotY += (targetRotY - curRotY) * 0.14;

        activeCard.style.transform = `perspective(1100px) rotateX(${curRotX.toFixed(2)}deg) rotateY(${curRotY.toFixed(2)}deg) translateZ(4px)`;
        activeCard.style.setProperty('--mouse-x', `${mouseXPct.toFixed(1)}%`);
        activeCard.style.setProperty('--mouse-y', `${mouseYPct.toFixed(1)}%`);

        if (Math.abs(targetRotX - curRotX) > 0.01 || Math.abs(targetRotY - curRotY) > 0.01) {
          rafId = requestAnimationFrame(animateTilt);
        } else {
          rafId = null;
        }
      };

      const resetCard = (card) => {
        if (!card) return;
        card.classList.remove('is-tilting');
        card.style.transform = '';
        card.style.removeProperty('--mouse-x');
        card.style.removeProperty('--mouse-y');
        targetRotX = 0;
        targetRotY = 0;
        curRotX = 0;
        curRotY = 0;
        cardRect = null;
      };

      grid.addEventListener('mousemove', (e) => {
        const card = e.target.closest('.product-item-card');
        if (!card) {
          if (activeCard) {
            resetCard(activeCard);
            activeCard = null;
          }
          return;
        }

        if (activeCard !== card) {
          if (activeCard) resetCard(activeCard);
          activeCard = card;
          card.classList.add('is-tilting');
          cardRect = card.getBoundingClientRect();
        }

        if (!cardRect) {
          cardRect = card.getBoundingClientRect();
        }

        const x = e.clientX - cardRect.left;
        const y = e.clientY - cardRect.top;

        mouseXPct = Math.max(0, Math.min(100, (x / cardRect.width) * 100));
        mouseYPct = Math.max(0, Math.min(100, (y / cardRect.height) * 100));

        const maxTilt = 3.6;
        targetRotY = ((x / cardRect.width) - 0.5) * (maxTilt * 2);
        targetRotX = -((y / cardRect.height) - 0.5) * (maxTilt * 2);

        if (!rafId) {
          rafId = requestAnimationFrame(animateTilt);
        }
      });

      grid.addEventListener('mouseleave', () => {
        if (activeCard) {
          resetCard(activeCard);
          activeCard = null;
        }
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      });
    });
  };

  // --- SVG ICON DICTIONARIES ---
  const ADVANTAGE_ICONS = {
    cnc: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    wood: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    felt: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
    track: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
    warranty: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`,
    ruler: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7l-5-5a1 1 0 0 0-1.4 0l-12 12a1 1 0 0 0 0 1.4l5 5a1 1 0 0 0 1.4 0l12-12a1 1 0 0 0 0-1.4z"></path><line x1="7.5" y1="10.5" x2="9.5" y2="12.5"></line><line x1="10.5" y1="7.5" x2="12.5" y2="9.5"></line><line x1="13.5" y1="4.5" x2="15.5" y2="6.5"></line></svg>`
  };

  const ABOUT_ICONS = {
    russia: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    design: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>`,
    materials: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
    quality: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`
  };

  const renderAdvantages = () => {
    const wrap = document.getElementById('advantagesGrid');
    if (!wrap) return;
    wrap.innerHTML = GEEKNOOK_DATA.advantages.map((adv, idx) => `
      <div class="advantage-col reveal-card" style="--stagger-delay: ${idx * 0.06}s;">
        <span class="advantage-idx">${String(idx + 1).padStart(2, '0')} // СТАНДАРТ</span>
        <div class="advantage-icon-circle">${ADVANTAGE_ICONS[adv.icon] || ""}</div>
        <h4 class="advantage-title">${adv.title}</h4>
        <p class="advantage-descr">${adv.descr}</p>
      </div>
    `).join('');
  };

  const renderProduction = () => {
    const photosWrap = document.getElementById('productionPhotosRow');
    if (!photosWrap) return;
    photosWrap.innerHTML = GEEKNOOK_DATA.production.photos.map((p, idx) => `
      <div class="prod-photo-item reveal-card" style="--stagger-delay: ${idx * 0.1}s;" onclick="window.geekNookApp.openLightbox('${toAssetUrl(p.src)}', '${p.caption}')">
        <img src="${toAssetUrl(p.src)}" alt="${p.caption}" loading="lazy" />
        <div class="prod-photo-caption">${p.caption}</div>
      </div>
    `).join('');
  };

  const renderClientSetups = () => {
    const wrap = document.getElementById('clientSetupsRow');
    if (!wrap || !GEEKNOOK_DATA.clientSetups) return;
    wrap.innerHTML = GEEKNOOK_DATA.clientSetups.map((s, idx) => `
      <div class="setup-review-card reveal-card" style="--stagger-delay: ${idx * 0.08}s;">
        <div class="setup-review-img-wrap" onclick="window.geekNookApp.openLightbox('${toAssetUrl(s.src)}', '${s.title} • ${s.author}')">
          <img src="${toAssetUrl(s.src)}" alt="${s.title}" loading="lazy" decoding="async" />
          <div class="setup-review-badge">SETUP // 0${idx + 1} • ${s.tag}</div>
        </div>
        <div class="setup-review-body">
          <div class="review-stars-row">
            <div class="review-stars" aria-label="5 из 5 звёзд">★★★★★</div>
            <span class="review-score">${(s.rating || 5.0).toFixed(1)}</span>
            <span class="review-verified-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Проверен
            </span>
          </div>
          <p class="review-quote">«${s.quote || s.text || ''}»</p>
          <div class="review-author-box">
            <div class="review-author-avatar">${s.author ? s.author.charAt(0) : 'G'}</div>
            <div>
              <div class="review-author-name">${s.author}</div>
              <div class="review-author-role">${s.role}</div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  };

  const renderGallery = () => {
    const wrap = document.getElementById('galleryGrid');
    if (!wrap) return;
    wrap.innerHTML = GEEKNOOK_DATA.gallery.map((g, idx) => `
      <div class="gallery-tile-item reveal-card" style="--stagger-delay: ${idx * 0.08}s;" onclick="window.geekNookApp.openLightbox('${toAssetUrl(g.src)}', '${g.title} — ${g.subtitle}')">
        <img src="${toAssetUrl(g.src)}" alt="${g.title}" loading="lazy" decoding="async" />
        <div class="gallery-tile-overlay">
          <div class="gallery-tile-title">${g.title}</div>
          <div class="gallery-tile-sub">${g.subtitle}</div>
        </div>
      </div>
    `).join('');
  };

  const renderAbout = () => {
    const badgesWrap = document.getElementById('aboutBadgesGrid');
    if (!badgesWrap) return;
    badgesWrap.innerHTML = GEEKNOOK_DATA.about.badges.map(b => `
      <div class="about-badge-card">
        <span class="about-badge-icon">${ABOUT_ICONS[b.icon] || ""}</span>
        <span>${b.title}</span>
      </div>
    `).join('');
  };

  const renderJournal = () => {
    const wrap = document.getElementById('journalGrid');
    if (!wrap || !GEEKNOOK_DATA.articles) return;
    wrap.innerHTML = GEEKNOOK_DATA.articles.map((art, idx) => `
      <div class="journal-card-item reveal-card" style="--stagger-delay: ${idx * 0.1}s;" onclick="window.geekNookApp.openArticle('${art.id}')">
        <div class="journal-img-wrap">
          <span class="journal-badge">СТАТЬЯ // ${art.readTime}</span>
          <img src="${toAssetUrl(art.image)}" alt="${art.title}" loading="lazy" decoding="async" />
        </div>
        <div class="journal-card-body">
          <h3 class="journal-card-title">${art.title}</h3>
          <p class="journal-card-preview">${art.preview}</p>
          <div class="journal-card-link">
            <span>Читать статью</span>
          </div>
        </div>
      </div>
    `).join('');
  };

  // --- SCROLL-DRIVEN REVEAL OBSERVER ---
  const initScrollReveals = () => {
    document.querySelectorAll('.block-header, .configurator-callout-box, .production-text-col, .about-split-grid').forEach(el => {
      el.classList.add('reveal-on-scroll');
    });

    const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-card');

    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -30px 0px'
    });

    elements.forEach(el => observer.observe(el));
  };

  // --- QUICK VIEW MODAL ---
  const openQuickView = (productId) => {
    const product = GEEKNOOK_DATA.allProducts.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('quickViewModal');
    const content = document.getElementById('quickViewContent');
    if (!modal || !content) return;

    let optionsHtml = '';
    if (product.options && product.options.lengths) {
      optionsHtml = `
        <div style="margin-bottom:18px;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Размер основания:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${product.options.lengths.map((len, idx) => `
              <button type="button" class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${len}" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);font-size:0.875rem;font-weight:600;cursor:pointer;transition:all var(--transition-fast);">
                ${len} ${len.includes('85') ? '(Компакт)' : '(Простор)'}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else if (product.options && product.options.sizes) {
      optionsHtml = `
        <div style="margin-bottom:18px;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Размер коврика:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${product.options.sizes.map((sz, idx) => `
              <button type="button" class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${sz}" style="padding:8px 16px;border-radius:6px;border:1px solid var(--border);font-size:0.875rem;font-weight:600;cursor:pointer;transition:all var(--transition-fast);">${sz}</button>
            `).join('')}
          </div>
        </div>
      `;
    }

    const specsHtml = Object.entries(product.specs || {}).map(([k, v]) => `
      <tr data-spec-key="${k}">
        <td>${k}</td>
        <td class="spec-val-cell">${v}</td>
      </tr>
    `).join('');

    content.innerHTML = `
      <div class="quick-view-grid">
        <div>
          <div class="quick-gallery-main">
            <img id="qvMainImg" src="${toAssetUrl(product.images[0])}" alt="${product.title}" />
          </div>
          <div class="quick-gallery-thumbs">
            ${product.images.map((img, idx) => `
              <img class="quick-thumb ${idx === 0 ? 'active' : ''}" src="${toAssetUrl(img)}" onclick="window.geekNookApp.switchQvImage('${toAssetUrl(img)}', this)" />
            `).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;">
          <div style="font-size:0.75rem;color:var(--primary);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">
            ${product.category === 'boards' ? 'Флагманская доска' : (product.category === 'accessories' ? 'Модуль T-Track' : 'Аксессуар')}
          </div>
          <h2 style="font-family:var(--font-display);font-size:1.85rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px;">${product.title}</h2>
          <div style="font-size:0.9375rem;color:var(--text-muted);margin-bottom:18px;">${product.subtitle || ''}</div>

          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px;">
            <span id="qvPriceCurrent" style="font-family:var(--font-mono);font-size:1.85rem;font-weight:800;letter-spacing:-0.02em;color:var(--text-main);">${formatPrice(product.price)}</span>
            <span id="qvPriceOld" style="font-family:var(--font-mono);font-size:1.1rem;color:var(--text-subtle);text-decoration:line-through;">${product.oldPrice ? formatPrice(product.oldPrice) : ''}</span>
          </div>

          <p style="font-size:0.9375rem;line-height:1.65;color:var(--text-main);margin-bottom:20px;">${product.fullDescr || product.shortDescr || ''}</p>

          ${optionsHtml}

          <table class="specs-table">
            <tbody>
              ${specsHtml}
            </tbody>
          </table>

          <div style="margin-top:auto;display:flex;gap:10px;padding-top:16px;flex-wrap:wrap;">
            <button class="btn-checkout" onclick="window.geekNookApp.addFromQuickView('${product.id}')" style="flex:1;min-width:140px;">
              Добавить в корзину
            </button>
            <button class="btn-secondary" onclick="window.geekNookApp.openQuickBuy('${product.id}')" style="flex:1;min-width:140px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">
              Купить в 1 клик
            </button>
          </div>
        </div>
      </div>
    `;

    // Dynamic Option Chips Click Handler (Price & Specs Switching)
    content.querySelectorAll('.option-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.parentElement.querySelectorAll('.option-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const val = btn.getAttribute('data-val');
        if (!val) return;

        // Dynamic price update
        if (product.optionPrices && product.optionPrices[val]) {
          const curEl = document.getElementById('qvPriceCurrent');
          const oldEl = document.getElementById('qvPriceOld');
          if (curEl) {
            curEl.textContent = formatPrice(product.optionPrices[val]);
            curEl.classList.remove('price-pulse');
            void curEl.offsetWidth;
            curEl.classList.add('price-pulse');
          }
          if (oldEl) {
            oldEl.textContent = (product.optionOldPrices && product.optionOldPrices[val]) ? formatPrice(product.optionOldPrices[val]) : '';
          }
        }

        // Dynamic dimensions update in specs table
        if (product.skus && product.skus[val]) {
          const skuInfo = product.skus[val];
          const dimRow = content.querySelector('tr[data-spec-key="Габариты"] .spec-val-cell');
          if (dimRow && skuInfo.dimensions) {
            dimRow.textContent = skuInfo.dimensions;
          }
        }
      });
    });

    modalManager.open('quickViewModal');
  };

  const switchQvImage = (src, thumbEl) => {
    const mainImg = document.getElementById('qvMainImg');
    if (mainImg) mainImg.src = src;
    document.querySelectorAll('.quick-thumb').forEach(t => t.classList.remove('active'));
    if (thumbEl) thumbEl.classList.add('active');
  };

  const addFromQuickView = (productId) => {
    const modal = document.getElementById('quickViewModal');
    let opt = 'Стандарт';
    const activeChip = modal ? modal.querySelector('.option-chip.active') : null;
    if (activeChip) {
      opt = activeChip.getAttribute('data-val') || 'Стандарт';
    }
    const cartAdd = (window.geekNookApp && window.geekNookApp.addToCart) ? window.geekNookApp.addToCart : addToCart;
    cartAdd(productId, opt);
    closeModal('quickViewModal');
  };

  // --- CONFIGURATOR WORKBENCH ---
  const openConfigurator = () => {
    renderConfiguratorUI();
    modalManager.open('configuratorModal');
  };

  const triggerPricePulse = () => {
    const priceEl = document.getElementById('modalConfigTotalPrice');
    if (!priceEl) return;
    priceEl.classList.remove('price-pulse');
    void priceEl.offsetWidth;
    priceEl.classList.add('price-pulse');
  };

  const renderConfiguratorUI = () => {
    const finish = GEEKNOOK_DATA.configurator.finishes.find(f => f.id === state.config.finishId) || GEEKNOOK_DATA.configurator.finishes[0];
    const length = GEEKNOOK_DATA.configurator.lengths.find(l => l.id === state.config.lengthId) || GEEKNOOK_DATA.configurator.lengths[0];

    const previewImg = document.getElementById('modalConfigPreviewImg');
    const statusPill = document.getElementById('modalConfigStatusPill');
    const totalPriceEl = document.getElementById('modalConfigTotalPrice');

    if (previewImg) previewImg.src = toAssetUrl(finish.img);
    if (statusPill) statusPill.textContent = `Focus Station • ${finish.name} • ${length.id} см`;

    // Calculate total price with optional laser engraving
    const addonsTotal = state.config.selectedAddonIds.reduce((sum, id) => {
      const a = GEEKNOOK_DATA.configurator.addons.find(item => item.id === id);
      return sum + (a ? a.price : 0);
    }, 0);

    const engravingPrice = state.config.engravingEnabled ? 1200 : 0;
    const grandTotal = length.priceBase + finish.priceDelta + addonsTotal + engravingPrice;
    if (totalPriceEl) totalPriceEl.textContent = formatPrice(grandTotal);

    // Sync Engraving badge and inputs
    const engravingBadge = document.getElementById('engravingBadgeOverlay');
    const engravingText = document.getElementById('engravingBadgeText');
    const engravingCheckbox = document.getElementById('configEngravingCheckbox');
    const engravingInputWrap = document.getElementById('configEngravingInputWrap');
    const engravingInput = document.getElementById('configEngravingInput');

    if (engravingCheckbox) engravingCheckbox.checked = Boolean(state.config.engravingEnabled);
    if (engravingInputWrap) engravingInputWrap.style.display = state.config.engravingEnabled ? 'block' : 'none';
    if (engravingBadge) engravingBadge.style.display = state.config.engravingEnabled ? 'flex' : 'none';
    if (engravingText) engravingText.textContent = state.config.engravingText ? state.config.engravingText.toUpperCase() : 'GEEKNOOK // LAB';
    if (engravingInput && !engravingInput.value) engravingInput.value = state.config.engravingText || '';

    // Finishes
    const finishesWrap = document.getElementById('modalConfigFinishes');
    if (finishesWrap) {
      finishesWrap.innerHTML = GEEKNOOK_DATA.configurator.finishes.map(f => `
        <div class="finish-option ${f.id === state.config.finishId ? 'active' : ''}" 
             onclick="window.geekNookApp.selectConfigFinish('${f.id}')"
             style="border:2px solid ${f.id === state.config.finishId ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:12px;cursor:pointer;background:var(--surface-card);color:var(--text-main);transition:all var(--transition-fast);">
          <div style="width:24px;height:24px;border-radius:50%;background:${f.hex};margin-bottom:8px;border:1px solid rgba(128,128,128,0.3);"></div>
          <div style="font-weight:700;font-size:0.875rem;">${f.name}</div>
        </div>
      `).join('');
    }

    // Lengths
    const lengthsWrap = document.getElementById('modalConfigLengths');
    if (lengthsWrap) {
      lengthsWrap.innerHTML = GEEKNOOK_DATA.configurator.lengths.map(l => `
        <div class="length-btn ${l.id === state.config.lengthId ? 'active' : ''}" 
             onclick="window.geekNookApp.selectConfigLength('${l.id}')"
             style="border:2px solid ${l.id === state.config.lengthId ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:12px;cursor:pointer;background:var(--surface-card);color:var(--text-main);transition:all var(--transition-fast);">
          <div style="font-weight:800;font-size:0.9375rem;">${l.title}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${l.descr}</div>
        </div>
      `).join('');
    }

    // Addons
    const addonsWrap = document.getElementById('modalConfigAddons');
    if (addonsWrap) {
      addonsWrap.innerHTML = GEEKNOOK_DATA.configurator.addons.map(a => {
        const isSelected = state.config.selectedAddonIds.includes(a.id);
        return `
          <div class="addon-check-item ${isSelected ? 'active' : ''}" 
               onclick="window.geekNookApp.toggleConfigAddon('${a.id}')"
               style="display:flex;align-items:center;justify-content:space-between;border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:10px 14px;cursor:pointer;background:var(--surface-card);color:var(--text-main);margin-bottom:8px;transition:all var(--transition-fast);">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${toAssetUrl(a.img)}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" />
              <div>
                <div style="font-size:0.875rem;font-weight:600;">${a.name}</div>
                <div style="font-size:0.8125rem;color:var(--primary);font-weight:700;">+${formatPrice(a.price)}</div>
              </div>
            </div>
            <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};background:${isSelected ? 'var(--primary)' : 'transparent'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;">
              ${isSelected ? '✓' : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  };

  const selectConfigFinish = (id) => {
    if (state.config.finishId === id) return;
    state.config.finishId = id;
    soundEngine.play('click');

    const previewImg = document.getElementById('modalConfigPreviewImg');
    if (previewImg) {
      previewImg.classList.add('crossfade-out');
      setTimeout(() => {
        renderConfiguratorUI();
        triggerPricePulse();
        previewImg.classList.remove('crossfade-out');
        previewImg.classList.add('crossfade-in');
        setTimeout(() => previewImg.classList.remove('crossfade-in'), 250);
      }, 140);
    } else {
      renderConfiguratorUI();
      triggerPricePulse();
    }
  };

  const selectConfigLength = (id) => {
    state.config.lengthId = id;
    soundEngine.play('click');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const toggleConfigAddon = (id) => {
    const idx = state.config.selectedAddonIds.indexOf(id);
    if (idx >= 0) {
      state.config.selectedAddonIds.splice(idx, 1);
    } else {
      state.config.selectedAddonIds.push(id);
    }
    soundEngine.play('click');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const toggleConfigEngraving = (enabled) => {
    state.config.engravingEnabled = Boolean(enabled);
    soundEngine.play('toggle');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const updateConfigEngravingText = (text) => {
    state.config.engravingText = text;
    const badgeText = document.getElementById('engravingBadgeText');
    if (badgeText) {
      badgeText.textContent = text.trim() ? text.trim().toUpperCase() : 'GEEKNOOK // LAB';
    }
    if (focusStation3DStudio?.isInitialized) {
      focusStation3DStudio.updateModel();
    }
  };

  // --- PROCEDURAL PHOTOREALISTIC WOOD TEXTURES & THREE.JS 3D ENGINE ---
  let cachedWoodTextures = null;

  const getWoodTextures = () => {
    if (cachedWoodTextures) return cachedWoodTextures;
    if (typeof THREE === 'undefined') return null;

    const finishes = {
      'finish-oak': {
        name: 'Кавказский дуб',
        base: ['#caa06e', '#bc9360', '#ab804d', '#dab17f'],
        fiber: 'rgba(124, 84, 42, 0.20)',
        rings: 'rgba(90, 61, 30, 0.24)',
        pores: 'rgba(70, 45, 20, 0.16)',
        roughness: 0.38,
        metalness: 0.04
      },
      'finish-walnut': {
        name: 'Американский орех',
        base: ['#4e321e', '#3e2413', '#563821', '#341d0e'],
        fiber: 'rgba(35, 18, 7, 0.24)',
        rings: 'rgba(26, 13, 5, 0.28)',
        pores: 'rgba(20, 10, 4, 0.18)',
        roughness: 0.34,
        metalness: 0.04
      },
      'finish-black': {
        name: 'Чёрное дерево',
        base: ['#1c1d22', '#16171a', '#22232a', '#141417'],
        fiber: 'rgba(40, 42, 50, 0.25)',
        rings: 'rgba(10, 10, 14, 0.35)',
        pores: 'rgba(50, 52, 62, 0.18)',
        roughness: 0.42,
        metalness: 0.06
      }
    };

    cachedWoodTextures = {};

    Object.entries(finishes).forEach(([key, config]) => {
      // 1. Diffuse canvas (1024x512)
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 1024, 0);
      grad.addColorStop(0, config.base[0]);
      grad.addColorStop(0.33, config.base[1]);
      grad.addColorStop(0.66, config.base[2]);
      grad.addColorStop(1, config.base[3]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Sinusoidal longitudinal wood fibers
      for (let y = 0; y < 512; y += 2) {
        const alpha = 0.06 + Math.sin(y * 0.1) * 0.04 + Math.cos(y * 0.025) * 0.03;
        ctx.strokeStyle = config.fiber;
        ctx.lineWidth = 1 + (y % 4 === 0 ? 1.5 : 0.6);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < 1024; x += 24) {
          const wave = Math.sin(x * 0.012 + y * 0.02) * 5 + Math.cos(x * 0.03) * 2;
          ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }

      // Organic annual ring swirls
      for (let i = 0; i < 3; i++) {
        const cx = 180 + i * 320;
        const cy = 200 + (i % 2) * 80;
        for (let r = 12; r < 100; r += 9) {
          ctx.strokeStyle = config.rings;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 2.8, r * 0.65, 0.06, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Micro pores
      ctx.fillStyle = config.pores;
      for (let p = 0; p < 600; p++) {
        const px = Math.random() * 1024;
        const py = Math.random() * 512;
        ctx.fillRect(px, py, 2.5, 1);
      }

      // 2. Bump / Roughness Map (512x256)
      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 256;
      const bctx = bumpCanvas.getContext('2d');
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 512, 256);

      for (let y = 0; y < 256; y += 3) {
        const shade = Math.sin(y * 0.18) * 35;
        bctx.strokeStyle = shade > 0 
          ? `rgba(255, 255, 255, ${(shade / 140).toFixed(2)})` 
          : `rgba(0, 0, 0, ${(-shade / 140).toFixed(2)})`;
        bctx.lineWidth = 1.2;
        bctx.beginPath();
        bctx.moveTo(0, y);
        for (let x = 0; x < 512; x += 20) {
          const wave = Math.sin(x * 0.02 + y * 0.03) * 3.5;
          bctx.lineTo(x, y + wave);
        }
        bctx.stroke();
      }

      const diffuseTex = new THREE.CanvasTexture(canvas);
      diffuseTex.wrapS = THREE.ClampToEdgeWrapping;
      diffuseTex.wrapT = THREE.ClampToEdgeWrapping;

      const bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.wrapS = THREE.ClampToEdgeWrapping;
      bumpTex.wrapT = THREE.ClampToEdgeWrapping;

      cachedWoodTextures[key] = {
        diffuse: diffuseTex,
        bump: bumpTex,
        roughness: config.roughness,
        metalness: config.metalness
      };
    });

    return cachedWoodTextures;
  };

  const createBeveledDeckMesh = (width = 8.5, height = 0.24, depth = 2.3) => {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hd = depth / 2;
    const r = 0.12;

    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(Math.PI / 2);

    // Planar UV projection across horizontal desk face and edges
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const py = pos.getY(i);
      uvs.setXY(i, (px / width) + 0.5, (pz / depth) + 0.5 + py * 0.2);
    }
    uvs.needsUpdate = true;
    geo.computeVertexNormals();

    const textures = getWoodTextures();
    const oak = textures?.['finish-oak'] || {};
    const mat = new THREE.MeshStandardMaterial({
      map: oak.diffuse || null,
      bumpMap: oak.bump || null,
      bumpScale: 0.025,
      roughness: oak.roughness || 0.38,
      metalness: oak.metalness || 0.04
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const createContactShadowMesh = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.32)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11.0, 4.5), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.05;
    return plane;
  };

  function create3DSceneController(options) {
    return {
      isInitialized: false,
      isRunning: true,
      isVisible: true,
      rafId: null,
      observer: null,
      _animate: null,
      scene: null,
      camera: null,
      renderer: null,
      mainGroup: null,
      deckMesh: null,
      tTrackSlot: null,
      badgeMesh: null,
      badgeTexture: null,
      badgeCanvas: null,
      legsGroup: null,
      corkGroup: null,
      shadowMesh: null,
      modulesGroup: null,
      lights: {},
      isExploded: false,
      autoRotate: Boolean(options.autoRotateDefault),
      isUserInteracting: false,
      currentFinish: options.initialFinish || 'finish-oak',
      currentLength: options.initialLength || 85,
      lightingMode: 'studio',
      clock: new THREE.Clock(),

      start() {
        this.isRunning = true;
        if (!this.rafId && this.isVisible && this.renderer && this._animate) {
          this.clock.getDelta();
          this.rafId = requestAnimationFrame(this._animate);
        }
      },

      stop() {
        this.isRunning = false;
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      },

      init() {
        if (this.isInitialized) {
          this.updateModel();
          return;
        }
        if (typeof THREE === 'undefined') return;

        const canvas = document.getElementById(options.canvasId);
        const container = document.getElementById(options.containerId);
        if (!canvas || !container) return;

        const width = container.clientWidth || 600;
        const height = container.clientHeight || 420;
        const isMobile = (window.innerWidth || 1024) < 768;
        const maxDpr = isMobile ? 1.4 : 1.6;

        // 1. Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        this.camera.position.set(0, 5.2, 13.0);

        // 2. Renderer with soft shadows & powerPreference
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 3. Cinematic 3-Point Lights
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.82);
        this.scene.add(this.lights.ambient);

        this.lights.dir = new THREE.DirectionalLight(0xffffff, 1.05);
        this.lights.dir.position.set(7, 14, 9);
        this.lights.dir.castShadow = true;
        const shadowMapRes = isMobile ? 512 : 1024;
        this.lights.dir.shadow.mapSize.width = shadowMapRes;
        this.lights.dir.shadow.mapSize.height = shadowMapRes;
        this.lights.dir.shadow.bias = -0.0005;
        this.scene.add(this.lights.dir);

        this.lights.fill = new THREE.DirectionalLight(0xffffff, 0.4);
        this.lights.fill.position.set(-6, 4, 6);
        this.scene.add(this.lights.fill);

        this.lights.rim = new THREE.PointLight(0x60a5fa, 0.75, 25);
        this.lights.rim.position.set(-8, 5, -7);
        this.scene.add(this.lights.rim);

        // 4. Main Model Group
        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);

        this.buildModel();
        this.initOrbitControls(canvas);

        // 5. Render loop with idle breathing & auto-rotation (with offscreen pause)
        this._animate = () => {
          if (!this.isRunning || !this.isVisible) {
            this.rafId = null;
            return;
          }
          this.rafId = requestAnimationFrame(this._animate);
          const time = this.clock.getElapsedTime();

          // Idle organic floating & breathing
          const idleFloatY = Math.sin(time * 1.4) * 0.03;
          const targetDeckY = this.isExploded ? 1.85 : 1.0;
          const targetLegY = this.isExploded ? 0.22 : 0.48;
          const targetCorkY = this.isExploded ? -0.22 : -0.02;

          if (this.deckMesh) {
            this.deckMesh.position.y += (targetDeckY + idleFloatY - this.deckMesh.position.y) * 0.08;
          }
          if (this.legsGroup) {
            this.legsGroup.children.forEach(l => {
              l.position.y += (targetLegY - l.position.y) * 0.08;
            });
          }
          if (this.corkGroup) {
            this.corkGroup.children.forEach(c => {
              c.position.y += (targetCorkY - c.position.y) * 0.08;
            });
          }

          // Auto-rotation when enabled and user not dragging
          if (this.autoRotate && !this.isUserInteracting) {
            this.mainGroup.rotation.y += 0.0035;
          }

          // Smooth orbital momentum damping
          if (this.orbit && !this.orbit.isDragging) {
            if (Math.abs(this.orbit.velTheta) > 0.0001 || Math.abs(this.orbit.velPhi) > 0.0001) {
              this.orbit.spherical.theta += this.orbit.velTheta;
              this.orbit.spherical.phi = Math.max(0.35, Math.min(1.45, this.orbit.spherical.phi + this.orbit.velPhi));
              this.orbit.velTheta *= 0.92;
              this.orbit.velPhi *= 0.92;
              this.orbit.updateCam();
            }
          }

          this.renderer.render(this.scene, this.camera);
        };

        // Automatic IntersectionObserver to pause rendering when scrolled out of viewport
        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              const visible = entry.isIntersecting && entry.intersectionRatio > 0;
              this.isVisible = visible;
              if (this.isVisible) {
                if (!this.rafId && this.isRunning) {
                  this.clock.getDelta();
                  this.rafId = requestAnimationFrame(this._animate);
                }
              } else {
                if (this.rafId) {
                  cancelAnimationFrame(this.rafId);
                  this.rafId = null;
                }
              }
            });
          }, { threshold: [0, 0.05] });
          this.observer.observe(container);
        }

        this.rafId = requestAnimationFrame(this._animate);

        // Resize listener
        window.addEventListener('resize', () => {
          if (!container.clientWidth) return;
          const w = container.clientWidth;
          const h = container.clientHeight;
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        });

        this.isInitialized = true;
        this.updateModel();
      },

      buildModel() {
        // 1. Deck Mesh with bevel
        this.deckMesh = createBeveledDeckMesh(8.5, 0.24, 2.3);
        this.deckMesh.position.y = 1.0;
        this.mainGroup.add(this.deckMesh);

        // 2. T-Track Slot
        const slotGeo = new THREE.BoxGeometry(8.1, 0.08, 0.16);
        const slotMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.22,
          metalness: 0.85
        });
        this.tTrackSlot = new THREE.Mesh(slotGeo, slotMat);
        this.tTrackSlot.position.set(0, 0.11, -0.85);
        this.deckMesh.add(this.tTrackSlot);

        // 3. Metallic Engraved Badge
        this.badgeCanvas = document.createElement('canvas');
        this.badgeCanvas.width = 512;
        this.badgeCanvas.height = 128;
        this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
        this.updateBadgeTexture('GEEKNOOK // LAB');

        const badgeGeo = new THREE.BoxGeometry(1.6, 0.15, 0.03);
        const badgeMat = new THREE.MeshStandardMaterial({
          map: this.badgeTexture,
          metalness: 0.88,
          roughness: 0.28
        });
        this.badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        this.badgeMesh.position.set(2.8, 0, 1.16);
        this.deckMesh.add(this.badgeMesh);

        // 4. Aluminum Legs (Д16Т anodized)
        this.legsGroup = new THREE.Group();
        this.mainGroup.add(this.legsGroup);

        const legMat = new THREE.MeshStandardMaterial({
          color: 0x1e2634,
          metalness: 0.85,
          roughness: 0.25
        });
        const legGeo = new THREE.BoxGeometry(0.35, 1.0, 2.1);

        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-3.6, 0.48, 0);
        leftLeg.castShadow = true;
        this.legsGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(3.6, 0.48, 0);
        rightLeg.castShadow = true;
        this.legsGroup.add(rightLeg);

        // 5. Cork feet
        this.corkGroup = new THREE.Group();
        this.mainGroup.add(this.corkGroup);

        const corkMat = new THREE.MeshStandardMaterial({
          color: 0xb45309,
          roughness: 0.95,
          metalness: 0.0
        });
        const corkGeo = new THREE.BoxGeometry(0.37, 0.04, 2.12);

        const leftCork = new THREE.Mesh(corkGeo, corkMat);
        leftCork.position.set(-3.6, -0.02, 0);
        this.corkGroup.add(leftCork);

        const rightCork = new THREE.Mesh(corkGeo, corkMat);
        rightCork.position.set(3.6, -0.02, 0);
        this.corkGroup.add(rightCork);

        // 6. Contact Ground Shadow
        this.shadowMesh = createContactShadowMesh();
        this.mainGroup.add(this.shadowMesh);

        // 7. Addons / Modules group
        this.modulesGroup = new THREE.Group();
        this.mainGroup.add(this.modulesGroup);

        const laptopMod = new THREE.Group();
        laptopMod.name = 'addon-laptop-stand-open';
        const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.7), legMat);
        const lapUp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.05), legMat);
        lapUp.position.set(0, 0.55, -0.35);
        laptopMod.add(lapBase);
        laptopMod.add(lapUp);
        laptopMod.position.set(-1.8, 1.15, -0.85);
        this.modulesGroup.add(laptopMod);

        const hpMod = new THREE.Group();
        hpMod.name = 'addon-headphone-stand';
        const hpBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 16), legMat);
        hpBar.position.set(0, 0.7, 0);
        const hpHook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.4), legMat);
        hpHook.position.set(0, 1.4, 0.2);
        hpMod.add(hpBar);
        hpMod.add(hpHook);
        hpMod.position.set(1.8, 1.12, -0.85);
        this.modulesGroup.add(hpMod);

        const trayMod = new THREE.Group();
        trayMod.name = 'addon-phone-dock';
        const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), legMat);
        trayMod.add(trayMesh);
        trayMod.position.set(0, 1.15, -0.85);
        this.modulesGroup.add(trayMod);
      },

      updateBadgeTexture(text) {
        if (!this.badgeCanvas) return;
        const ctx = this.badgeCanvas.getContext('2d');
        const w = this.badgeCanvas.width;
        const h = this.badgeCanvas.height;

        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#d4af37');
        grad.addColorStop(0.5, '#fef08a');
        grad.addColorStop(1, '#b45309');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const drawScrew = (x, y) => {
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.stroke();
        };
        drawScrew(24, h / 2);
        drawScrew(w - 24, h / 2);

        ctx.fillStyle = '#291403';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const clean = (text || 'GEEKNOOK // LAB').toUpperCase();
        ctx.fillText(clean, w / 2, h / 2);

        if (this.badgeTexture) this.badgeTexture.needsUpdate = true;
      },

      initOrbitControls(canvas) {
        let isDragging = false;
        let prevMouse = { x: 0, y: 0 };
        let spherical = { radius: 13.0, theta: 0.25, phi: 1.15 };
        let velTheta = 0;
        let velPhi = 0;

        const updateCam = () => {
          this.camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
          this.camera.position.y = spherical.radius * Math.cos(spherical.phi);
          this.camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
          this.camera.lookAt(0, 0.7, 0);
        };

        this.orbit = {
          get isDragging() { return isDragging; },
          spherical,
          get velTheta() { return velTheta; },
          set velTheta(v) { velTheta = v; },
          get velPhi() { return velPhi; },
          set velPhi(v) { velPhi = v; },
          updateCam
        };

        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          this.isUserInteracting = true;
          velTheta = 0;
          velPhi = 0;
          prevMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - prevMouse.x;
          const dy = e.clientY - prevMouse.y;
          prevMouse = { x: e.clientX, y: e.clientY };

          velTheta = -dx * 0.006;
          velPhi = -dy * 0.006;
          spherical.theta += velTheta;
          spherical.phi = Math.max(0.35, Math.min(1.45, spherical.phi + velPhi));
          updateCam();
        });

        window.addEventListener('mouseup', () => {
          isDragging = false;
          setTimeout(() => { this.isUserInteracting = false; }, 800);
        });

        canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          spherical.radius = Math.max(7, Math.min(20, spherical.radius + e.deltaY * 0.012));
          updateCam();
        }, { passive: false });

        canvas.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            this.isUserInteracting = true;
            velTheta = 0;
            velPhi = 0;
            prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (!isDragging || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - prevMouse.x;
          const dy = e.touches[0].clientY - prevMouse.y;
          prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };

          velTheta = -dx * 0.006;
          velPhi = -dy * 0.006;
          spherical.theta += velTheta;
          spherical.phi = Math.max(0.35, Math.min(1.45, spherical.phi + velPhi));
          updateCam();
        }, { passive: true });

        window.addEventListener('touchend', () => {
          isDragging = false;
          setTimeout(() => { this.isUserInteracting = false; }, 800);
        });

        updateCam();
      },

      updateModel() {
        if (!this.deckMesh) return;

        // 1. Finish texture & material
        const textures = getWoodTextures();
        const wood = textures?.[this.currentFinish] || textures?.['finish-oak'];
        if (wood && this.deckMesh.material) {
          this.deckMesh.material.map = wood.diffuse;
          this.deckMesh.material.bumpMap = wood.bump;
          this.deckMesh.material.bumpScale = 0.02;
          this.deckMesh.material.roughness = wood.roughness;
          this.deckMesh.material.metalness = wood.metalness;
          this.deckMesh.material.needsUpdate = true;
        }

        // 2. Length scale
        const scaleX = Number(this.currentLength) === 116 ? 1.36 : 1.0;
        this.deckMesh.scale.x = scaleX;

        if (this.legsGroup) {
          const legOffset = 3.6 * scaleX;
          this.legsGroup.children[0].position.x = -legOffset;
          this.legsGroup.children[1].position.x = legOffset;
          this.corkGroup.children[0].position.x = -legOffset;
          this.corkGroup.children[1].position.x = legOffset;
        }
        if (this.shadowMesh) {
          this.shadowMesh.scale.x = scaleX;
        }

        // Status badge
        if (options.statusBadgeId) {
          const badge = document.getElementById(options.statusBadgeId);
          if (badge) {
            const woodName = this.currentFinish === 'finish-walnut' ? 'Американский орех' : (this.currentFinish === 'finish-black' ? 'Чёрное дерево' : 'Кавказский дуб 22 мм');
            badge.textContent = `Focus Station • ${woodName} • ${this.currentLength} см • Сплав Д16Т • Т-паз 45°`;
          }
        }
      },

      setFinish(finishId) {
        this.currentFinish = finishId;
        this.updateModel();
      },

      setLength(len) {
        this.currentLength = Number(len);
        this.updateModel();
      },

      toggleExplode() {
        this.isExploded = !this.isExploded;
        return this.isExploded;
      },

      toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
        return this.autoRotate;
      },

      setLighting(mode) {
        this.lightingMode = mode;
        if (mode === 'cyber') {
          this.lights.ambient.color.setHex(0x1e1b4b);
          this.lights.dir.color.setHex(0x06b6d4);
          this.lights.rim.color.setHex(0xec4899);
        } else if (mode === 'sunset') {
          this.lights.ambient.color.setHex(0x7c2d12);
          this.lights.dir.color.setHex(0xfb923c);
          this.lights.rim.color.setHex(0xfacc15);
        } else {
          // studio
          this.lights.ambient.color.setHex(0xffffff);
          this.lights.dir.color.setHex(0xffffff);
          this.lights.rim.color.setHex(0x60a5fa);
        }
      }
    };
  }

  // 1. Configurator 3D Studio Instance
  const focusStation3DStudio = create3DSceneController({
    canvasId: 'config3dCanvas',
    containerId: 'config3dViewport',
    autoRotateDefault: false
  });

  // Configurator-specific module sync
  const originalConfigUpdate = focusStation3DStudio.updateModel.bind(focusStation3DStudio);
  focusStation3DStudio.updateModel = function() {
    this.currentFinish = state.config.finishId;
    this.currentLength = state.config.lengthId;
    originalConfigUpdate();

    // Laser Engraved Badge in modal
    if (this.badgeMesh) {
      this.badgeMesh.visible = Boolean(state.config.engravingEnabled);
      if (state.config.engravingEnabled) {
        this.updateBadgeTexture(state.config.engravingText);
      }
    }

    // Addon modules in modal
    if (this.modulesGroup) {
      const hasAddons = state.config.selectedAddonIds.length > 0;
      const trackWrap = document.getElementById('config3dTrackWrap');
      if (trackWrap) trackWrap.style.display = hasAddons ? 'flex' : 'none';

      this.modulesGroup.children.forEach(child => {
        child.visible = state.config.selectedAddonIds.includes(child.name);
      });
    }
  };

  focusStation3DStudio.setModulePosition = function(pct) {
    const offset = (Number(pct) / 100) * 2.6;
    if (this.modulesGroup) {
      this.modulesGroup.position.x = offset;
    }
  };

  // 2. Production Section 3D Studio Instance (Embedded in Page)
  const production3DStudio = create3DSceneController({
    canvasId: 'production3dCanvas',
    containerId: 'prod3dViewport',
    statusBadgeId: 'prod3dStatusBadge',
    autoRotateDefault: true
  });

  const initProduction3DStudio = () => {
    if (typeof THREE !== 'undefined' && !production3DStudio.isInitialized) {
      production3DStudio.init();
    }
  };

  const setProduction3dFinish = (finishId) => {
    soundEngine.play('click');
    production3DStudio.setFinish(finishId);
    document.querySelectorAll('#prod3dFinishPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-finish') === finishId);
    });
  };

  const setProduction3dLength = (len) => {
    soundEngine.play('click');
    production3DStudio.setLength(len);
    document.querySelectorAll('#prod3dLengthPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-len')) === Number(len));
    });
  };

  const setProduction3dLighting = (mode) => {
    soundEngine.play('click');
    production3DStudio.setLighting(mode);
    document.querySelectorAll('#prod3dLightPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-light') === mode);
    });
  };

  const toggleProduction3dExplode = () => {
    soundEngine.play('click');
    const isExp = production3DStudio.toggleExplode();
    const btn = document.getElementById('btnProd3dExplode');
    if (btn) btn.classList.toggle('active', isExp);
    showToast(isExp ? '3D Взрыв-схема: компоненты разнесены' : '3D Сборка Focus Station');
  };

  const toggleProduction3dAutoRotate = () => {
    soundEngine.play('click');
    const rotating = production3DStudio.toggleAutoRotate();
    const btn = document.getElementById('btnProd3dAutoRotate');
    if (btn) btn.classList.toggle('active', rotating);
    showToast(rotating ? 'Авто-вращение 360° включено' : 'Авто-вращение остановлено');
  };

  const toggleProduction3dAddon = (addonId) => {
    soundEngine.play('click');
    if (!production3DStudio.modulesGroup) return;
    const item = production3DStudio.modulesGroup.getObjectByName(addonId);
    let isVisible = false;
    if (item) {
      item.visible = !item.visible;
      isVisible = item.visible;
    }
    const btn = document.querySelector(`#prod3dAddonPills [data-addon="${addonId}"]`);
    if (btn) btn.classList.toggle('active', isVisible);

    let label = 'Модуль';
    if (addonId === 'addon-laptop-stand-open') label = 'Кронштейн ноутбука';
    else if (addonId === 'addon-headphone-stand') label = 'Стойка наушников';
    else if (addonId === 'addon-phone-dock') label = 'Док-станция для телефона';
    showToast(isVisible ? `✨ ${label} установлен на Т-паз 45°` : `${label} снят с подставки`);
  };

  const setConfigViewMode = (mode) => {
    soundEngine.play('toggle');
    const btn2d = document.getElementById('configView2dBtn');
    const btn3d = document.getElementById('configView3dBtn');
    const wrap2d = document.getElementById('config2dPreviewWrap');
    const wrap3d = document.getElementById('config3dViewport');

    if (mode === '3d') {
      btn2d?.classList.remove('active');
      btn3d?.classList.add('active');
      if (wrap2d) wrap2d.style.display = 'none';
      if (wrap3d) {
        wrap3d.style.display = 'block';
        focusStation3DStudio.init();
        focusStation3DStudio.start();
      }
    } else {
      btn3d?.classList.remove('active');
      btn2d?.classList.add('active');
      if (wrap3d) wrap3d.style.display = 'none';
      if (wrap2d) wrap2d.style.display = 'block';
      focusStation3DStudio.stop();
    }
  };

  const toggle3dExplode = () => focusStation3DStudio.toggleExplode();
  const set3dLighting = (mode) => focusStation3DStudio.setLighting(mode);
  const update3dModulePosition = (val) => focusStation3DStudio.setModulePosition(val);

  const addConfiguredBundleToCart = () => {
    const finish = GEEKNOOK_DATA.configurator.finishes.find(f => f.id === state.config.finishId);
    const length = GEEKNOOK_DATA.configurator.lengths.find(l => l.id === state.config.lengthId);

    // Add main shelf
    const engravingSuffix = state.config.engravingEnabled 
      ? ` + Лазерная гравировка [${state.config.engravingText || 'GEEKNOOK LAB'}]` 
      : '';
    const mainShelfPrice = length.priceBase + finish.priceDelta + (state.config.engravingEnabled ? 1200 : 0);
    
    // Custom shelf cart key
    const boardId = finish.id === 'oak' ? 'focus-station-oak' : (finish.id === 'black' ? 'focus-station-black' : 'focus-station-walnut');
    const boardTitle = `Focus Station ${length.id} (${finish.name})`;
    const shelfKey = `${boardId}_${length.id}_${state.config.engravingEnabled ? 'engraved' : 'plain'}`;
    const existingShelf = state.cart.find(i => i.cartKey === shelfKey);
    if (existingShelf) {
      existingShelf.quantity += 1;
    } else {
      state.cart.push({
        cartKey: shelfKey,
        id: boardId,
        title: boardTitle,
        option: `${length.id} см (${finish.name})${engravingSuffix}`,
        price: mainShelfPrice,
        image: finish.img,
        quantity: 1
      });
    }

    // Add individual selected modular addons with deduplication
    state.config.selectedAddonIds.forEach(id => {
      const addon = GEEKNOOK_DATA.configurator.addons.find(a => a.id === id);
      if (addon) {
        const cartKey = `custom_${addon.id}`;
        const existing = state.cart.find(i => i.cartKey === cartKey);
        if (existing) {
          existing.quantity += 1;
        } else {
          state.cart.push({
            cartKey,
            id: addon.id,
            title: addon.name,
            option: 'Модуль T-Track',
            price: addon.price,
            image: addon.img,
            quantity: 1
          });
        }
      }
    });

    saveCart();
    triggerBadgeBounce();
    soundEngine.play('cart');
    closeModal('configuratorModal');
    showToast('Индивидуальный комплект добавлен в корзину!', 'success');
    openCartDrawer();
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

  // --- LIGHTBOX GALLERY ---
  const openLightbox = (src, caption = '') => {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');
    if (!modal || !img) return;

    let finalSrc = src || '';
    if (typeof window.getGeekNookAssetUrl === 'function') {
      finalSrc = window.getGeekNookAssetUrl(finalSrc);
    } else if (finalSrc && (finalSrc.startsWith('images/') || finalSrc.startsWith('./images/')) && !finalSrc.startsWith('http') && window.GEEKNOOK_CDN_URL) {
      finalSrc = window.GEEKNOOK_CDN_URL + finalSrc.replace(/^\.?\//, '');
    }

    img.src = finalSrc;
    if (captionEl) captionEl.textContent = escapeHTML(caption);

    modalManager.open('lightboxModal');
  };

  // --- JOURNAL ARTICLE READER ---
  const openArticle = (articleId) => {
    const article = GEEKNOOK_DATA?.articles?.find(a => a.id === articleId);
    if (!article) return;

    const content = document.getElementById('articleModalContent');
    if (!content) return;

    content.innerHTML = `
      <div style="padding:clamp(24px, 4vw, 48px);max-width:860px;margin:0 auto;">
        <div style="font-size:0.8125rem;color:var(--primary);font-weight:700;margin-bottom:8px;font-family:var(--font-mono);letter-spacing:0.06em;">ЖУРНАЛ GEEKNOOK • ${escapeHTML(article.readTime)}</div>
        <h2 style="font-size:clamp(1.6rem,2.8vw,2.4rem);font-weight:900;margin-bottom:18px;line-height:1.25;letter-spacing:-0.02em;">${escapeHTML(article.title)}</h2>
        <img src="${article.image}" alt="${escapeHTML(article.title)}" onerror="this.onerror=null;this.src='images/tild3763-3337-4662-b233-616531316364__3.jpg'" style="border-radius:12px;margin:20px 0;width:100%;max-height:420px;object-fit:cover;box-shadow:0 12px 32px rgba(0,0,0,0.08);" />
        <div style="font-size:1.05rem;line-height:1.8;color:var(--text-main);">
          ${article.content}
        </div>
      </div>
    `;

    modalManager.open('articleModal');
  };

  const closeModal = (modalId) => {
    modalManager.close(modalId);
  };

  // --- FAQ ACCORDION ---
  const renderFAQ = () => {
    const list = document.getElementById('faqAccordionList');
    if (!list || !GEEKNOOK_DATA.faq) return;
    list.innerHTML = GEEKNOOK_DATA.faq.map((item, idx) => `
      <div class="faq-accordion-item ${idx === 0 ? 'active' : ''}" id="faqItem_${idx}">
        <button class="faq-question" onclick="window.geekNookApp.toggleFAQ(${idx})" aria-expanded="${idx === 0 ? 'true' : 'false'}">
          <span>${item.q}</span>
          <span class="faq-icon">+</span>
        </button>
        <div class="faq-answer">
          <p>${item.a}</p>
        </div>
      </div>
    `).join('');
  };

  const toggleFAQ = (idx) => {
    const item = document.getElementById(`faqItem_${idx}`);
    if (!item) return;
    const isCurrentlyActive = item.classList.contains('active');
    document.querySelectorAll('.faq-accordion-item').forEach(el => {
      el.classList.remove('active');
      const btn = el.querySelector('.faq-question');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    if (!isCurrentlyActive) {
      item.classList.add('active');
      const btn = item.querySelector('.faq-question');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  };

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
        <img class="quick-buy-prod-img" src="${toAssetUrl(product.images && product.images[0])}" alt="${safeTitle}" onerror="this.onerror=null;this.src=toAssetUrl('images/tild3763-3337-4662-b233-616531316364__3.jpg')" />
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

  // --- SHAREABLE CONFIGURATOR LINK ---
  const shareConfiguredSetup = () => {
    const hash = `config=finish:${state.config.finishId};length:${state.config.lengthId};addons:${state.config.selectedAddonIds.join(',')}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#${hash}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Ссылка на сборку скопирована в буфер обмена!');
      }).catch(() => {
        prompt('Ссылка на вашу сборку:', shareUrl);
      });
    } else {
      prompt('Ссылка на вашу сборку:', shareUrl);
    }
  };

  const parseUrlConfig = () => {
    try {
      const hash = window.location.hash;
      if (!hash || !hash.includes('config=')) return;
      const match = hash.match(/config=([^&]+)/);
      if (!match || !GEEKNOOK_DATA || !GEEKNOOK_DATA.configurator) return;

      const validFinishIds = GEEKNOOK_DATA.configurator.finishes.map(f => f.id);
      const validLengthIds = GEEKNOOK_DATA.configurator.lengths.map(l => l.id);
      const validAddonIds = GEEKNOOK_DATA.configurator.addons.map(a => a.id);

      const parts = match[1].split(';');
      parts.forEach(part => {
        const [rawKey, rawVal] = part.split(':');
        const key = String(rawKey || '').trim().toLowerCase();
        const val = String(rawVal || '').trim();

        if (key === 'finish' && validFinishIds.includes(val)) {
          state.config.finishId = val;
        } else if (key === 'length' && validLengthIds.includes(val)) {
          state.config.lengthId = val;
        } else if (key === 'addons') {
          const requested = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
          state.config.selectedAddonIds = requested.filter(id => validAddonIds.includes(id));
        }
      });

      openConfigurator();
      showToast('Сохранённая конфигурация сетапа загружена!');
    } catch (e) {
      console.warn('[Defensive] Error parsing URL config:', e);
    }
  };

  // --- INTERACTIVE SETUP FINDER QUIZ ---
  const QUIZ_DATA = {
    steps: [
      {
        id: 'setupType',
        title: '1. Какой тип вашего рабочего сетапа?',
        options: [
          { val: 'laptop_only', title: 'Один ноутбук (13–16")', desc: 'Компактное рабочее место, акцент на мобильность и минимализм', shelf: '85', shelfTitle: 'Focus Station 85 (85 см)' },
          { val: 'laptop_monitor', title: 'Ноутбук + Монитор 27–32"', desc: 'Самый популярный баланс для разработки, дизайна и аналитики', shelf: '85', shelfTitle: 'Focus Station 85 (85 см)' },
          { val: 'dual_ultrawide', title: 'Два монитора или Ultrawide 34–49"', desc: 'Широкая рабочая плоскость, требуется основание 116 см', shelf: '116', shelfTitle: 'Focus Station 116 (116 см)' },
          { val: 'creative_studio', title: 'Ноутбук + Планшет/Звуковая карта', desc: 'Сетап креатора: стриминг, аудиомонтаж или иллюстрация', shelf: '116', shelfTitle: 'Focus Station 116 (116 см)' }
        ]
      },
      {
        id: 'laptopUsage',
        title: '2. Как расположен ноутбук на вашем столе?',
        options: [
          { val: 'vertical', title: 'Вертикально (Clamshell)', desc: 'Ноутбук закрыт и подключён к монитору, экономит максимум места', addon: 'laptop-closed' },
          { val: 'raised', title: 'Открыт на кронштейне', desc: 'Используется как второй монитор на уровне глаз', addon: 'laptop-open' },
          { val: 'on_desk', title: 'На столе или стационарный ПК', desc: 'Свободное пространство под полкой для клавиатуры и трекпада', addon: 'u-shelf' }
        ]
      },
      {
        id: 'focusPriority',
        title: '3. Что важнее всего упорядочить?',
        options: [
          { val: 'audio', title: 'Полноразмерные наушники', desc: 'Подвес на алюминиевый кронштейн с мягкой силиконовой накладкой', addon: 'headphone-stand' },
          { val: 'charging', title: 'Смартфон и зарядка MagSafe', desc: 'Смартфон всегда перед глазами под удобным углом 65°', addon: 'phone-dock' },
          { val: 'desk_pad', title: 'Защита столешницы и ход мыши', desc: 'Натуральный шерстяной войлочный коврик высокой плотности', mat: 'desk-mat-light' }
        ]
      }
    ]
  };

  const openQuiz = () => {
    state.quiz.step = 1;
    state.quiz.answers = { setupType: null, laptopUsage: null, focusPriority: null };
    renderQuizStep();
    modalManager.open('quizModal');
  };

  const renderQuizStep = () => {
    const container = document.getElementById('quizContent');
    const fill = document.getElementById('quizProgressFill');
    if (!container) return;

    const currentStep = state.quiz.step;

    if (currentStep <= 3) {
      if (fill) fill.style.width = `${(currentStep / 3) * 100}%`;
      const stepData = QUIZ_DATA.steps[currentStep - 1];
      const selectedVal = state.quiz.answers[stepData.id];

      container.innerHTML = `
        <div class="quiz-step-title">${stepData.title}</div>
        <div class="quiz-options-grid">
          ${stepData.options.map(opt => `
            <div class="quiz-option-card ${selectedVal === opt.val ? 'selected' : ''}" onclick="window.geekNookApp.selectQuizOption('${stepData.id}', '${opt.val}')">
              <div class="quiz-opt-icon">${selectedVal === opt.val ? '✓' : ''}</div>
              <div class="quiz-option-title">${opt.title}</div>
              <div class="quiz-option-desc">${opt.desc}</div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          ${currentStep > 1 ? `
            <button class="btn-secondary" onclick="window.geekNookApp.prevQuizStep()" style="padding:10px 18px;font-size:0.875rem;">← Назад</button>
          ` : `<div></div>`}
          <div style="font-family:var(--font-mono);font-size:0.8125rem;color:var(--text-muted);">Шаг ${currentStep} из 3</div>
        </div>
      `;
    } else {
      if (fill) fill.style.width = '100%';
      renderQuizResult(container);
    }
  };

  const selectQuizOption = (stepKey, val) => {
    state.quiz.answers[stepKey] = val;
    state.quiz.step += 1;
    renderQuizStep();
  };

  const prevQuizStep = () => {
    if (state.quiz.step > 1) {
      state.quiz.step -= 1;
      renderQuizStep();
    }
  };

  const renderQuizResult = (container) => {
    const step1Choice = QUIZ_DATA.steps[0].options.find(o => o.val === state.quiz.answers.setupType) || QUIZ_DATA.steps[0].options[1];
    const step2Choice = QUIZ_DATA.steps[1].options.find(o => o.val === state.quiz.answers.laptopUsage) || QUIZ_DATA.steps[1].options[0];
    const step3Choice = QUIZ_DATA.steps[2].options.find(o => o.val === state.quiz.answers.focusPriority) || QUIZ_DATA.steps[2].options[0];

    const recommendedLength = step1Choice.shelf === '116' ? '116 см' : '85 см';
    const shelfProduct = GEEKNOOK_DATA.boards.find(b => b.id === 'focus-station-oak') || GEEKNOOK_DATA.boards[0];
    const shelfPrice = (shelfProduct.optionPrices && shelfProduct.optionPrices[recommendedLength]) || (recommendedLength === '116 см' ? 24990 : 19990);

    const addonList = [];
    if (step2Choice.addon) {
      const a = GEEKNOOK_DATA.accessories.find(x => x.id === step2Choice.addon);
      if (a) addonList.push(a);
    }
    if (step3Choice.addon) {
      const a = GEEKNOOK_DATA.accessories.find(x => x.id === step3Choice.addon);
      if (a && !addonList.some(x => x.id === a.id)) addonList.push(a);
    }
    let recommendedMat = null;
    if (step3Choice.mat) {
      recommendedMat = GEEKNOOK_DATA.mats[0];
    }

    const itemsTotal = shelfPrice + addonList.reduce((s, a) => s + a.price, 0) + (recommendedMat ? recommendedMat.price : 0);

    state.quizBundle = {
      shelf: shelfProduct,
      length: recommendedLength,
      addons: addonList,
      mat: recommendedMat,
      total: itemsTotal
    };

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,0.1);color:#10b981;margin-bottom:12px;border:1px solid rgba(16,185,129,0.25);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h3 style="font-size:1.35rem;font-weight:900;margin-bottom:6px;">Ваш персональный сетап готов!</h3>
        <p style="color:var(--text-muted);font-size:0.875rem;">Точный расчёт под габариты монитора и сценарии работы.</p>
      </div>

      <div class="quiz-result-box">
        <div class="quiz-result-shelf">
          <img class="quiz-result-shelf-img" src="${toAssetUrl(shelfProduct.images && shelfProduct.images[0])}" alt="${shelfProduct.title}" />
          <div>
            <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--primary);font-weight:700;text-transform:uppercase;">Базовая станция</div>
            <div style="font-weight:800;font-size:1.05rem;">${shelfProduct.title} (${recommendedLength})</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);">${shelfProduct.shortDescr || ''}</div>
            <div style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);margin-top:4px;">${formatPrice(shelfPrice)}</div>
          </div>
        </div>

        <div style="font-size:0.8125rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;font-family:var(--font-mono);">
          Рекомендованные модули:
        </div>
        <div class="quiz-result-addons-list">
          ${addonList.map(a => `
            <div class="quiz-result-addon-row">
              <span style="font-weight:600;">+ ${a.title}</span>
              <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);">${formatPrice(a.price)}</span>
            </div>
          `).join('')}
          ${recommendedMat ? `
            <div class="quiz-result-addon-row">
              <span style="font-weight:600;">+ ${recommendedMat.title}</span>
              <span style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);">${formatPrice(recommendedMat.price)}</span>
            </div>
          ` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px dashed var(--border);margin-top:10px;">
          <div>
            <div style="font-size:0.8125rem;color:var(--text-muted);">Стоимость комплекта:</div>
            <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:900;color:var(--text-main);">${formatPrice(itemsTotal)}</div>
          </div>
          <div class="config-modal-delivery-badge">✓ Бесплатная доставка</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button class="btn-checkout" onclick="window.geekNookApp.addQuizBundleToCart()" style="flex:1;min-width:180px;">
          Добавить комплект в корзину
        </button>
        <button class="btn-secondary" onclick="window.geekNookApp.openQuiz()" style="padding:12px 18px;font-size:0.875rem;">
          Пройти заново
        </button>
      </div>
    `;
  };

  const addQuizBundleToCart = () => {
    if (!state.quizBundle) return;
    const { shelf, addons, mat, length } = state.quizBundle;

    const cartAdd = (window.geekNookApp && window.geekNookApp.addToCart) ? window.geekNookApp.addToCart : addToCart;
    cartAdd(shelf.id, length || '85 см', false);
    addons.forEach(a => cartAdd(a.id, 'Стандарт', false));
    if (mat) cartAdd(mat.id, 'Стандарт', false);

    saveCart();
    triggerBadgeBounce();
    closeModal('quizModal');
    showToast('Персональный комплект добавлен в корзину!', 'success');
    const openDrawerFn = (window.geekNookApp && window.geekNookApp.openCartDrawer) ? window.geekNookApp.openCartDrawer : openCartDrawer;
    openDrawerFn();
  };

  // --- LEGAL MODAL TABS ---
  const openLegalModal = (tabId = 'delivery') => {
    const modal = document.getElementById('legalModal');
    if (!modal) return;
    switchLegalTab(tabId);
    modalManager.open('legalModal');
  };

  const switchLegalTab = (tabId) => {
    state.activeLegalTab = tabId;
    const body = document.getElementById('legalModalBody');
    if (body && GEEKNOOK_DATA.legal && GEEKNOOK_DATA.legal[tabId]) {
      const legalItem = GEEKNOOK_DATA.legal[tabId];
      body.innerHTML = typeof legalItem === 'object' ? legalItem.content : legalItem;
      body.scrollTop = 0;
    }
    const extLink = document.getElementById('legalModalExtLink');
    if (extLink) {
      extLink.href = 'legal.html#' + tabId;
    }
    document.querySelectorAll('.legal-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
        if (typeof btn.scrollIntoView === 'function') {
          btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      } else {
        btn.classList.remove('active');
      }
    });
  };

  // --- HERO VIDEO AUTOPLAY HELPER ---
  const initHeroVideo = () => {
    const video = document.querySelector('.hero-video-bg');
    if (!video) return;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const startPlay = () => {
          video.play().catch(() => {});
          window.removeEventListener('click', startPlay);
          window.removeEventListener('touchstart', startPlay);
          window.removeEventListener('scroll', startPlay);
        };
        window.addEventListener('click', startPlay, { once: true });
        window.addEventListener('touchstart', startPlay, { once: true });
        window.addEventListener('scroll', startPlay, { once: true });
      });
    }
  };

  // --- GOOGLE ANTIGRAVITY INTERACTIVE 3D PARTICLE SPHERE ---
  const initAntigravitySphere = () => {
    const canvas = document.getElementById('antigravityCanvas');
    const hero = document.getElementById('hero');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;

    const resize = () => {
      width = hero.clientWidth || window.innerWidth;
      height = hero.clientHeight || 700;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Optimized particle distribution on 3D sphere (Fibonacci lattice)
    const isMobile = (hero.clientWidth || window.innerWidth) < 768;
    const PARTICLE_COUNT = isMobile ? 120 : 220;
    const SPHERE_RADIUS = Math.min(width, height) > 800 ? 175 : 135;
    const particles = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      // Google Antigravity / DeepMind palette: Cyan, Electric Blue, Violet, Light Pearl
      const colorType = i % 5;
      let cr = 56, cg = 189, cb = 248; // cyan
      if (colorType === 0) { cr = 37; cg = 99; cb = 235; } // electric blue
      else if (colorType === 1) { cr = 129; cg = 140; cb = 248; } // violet
      else if (colorType === 2) { cr = 224; cg = 242; cb = 254; } // pearl white
      else if (colorType === 3) { cr = 14; cg = 165; cb = 233; } // sky

      particles.push({
        origX: x * SPHERE_RADIUS,
        origY: y * SPHERE_RADIUS,
        origZ: z * SPHERE_RADIUS,
        dispX: 0,
        dispY: 0,
        dispZ: 0,
        baseSize: 1.4 + Math.random() * 1.6,
        r: cr,
        g: cg,
        b: cb,
        projX: 0,
        projY: 0,
        projZ: 0,
        projScale: 1
      });
    }

    let isVisible = true;
    let isMouseInside = false;

    // Resting target position on right side of hero
    let currentX = width * 0.72;
    let currentY = height * 0.48;
    let targetX = currentX;
    let targetY = currentY;

    // 3D rotation angles & velocities
    let rotX = 0.25;
    let rotY = 0;
    let rotVelX = 0.003;
    let rotVelY = 0.005;

    let mouseClientX = 0;
    let mouseClientY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;

    let shockwaveRadius = 0;
    let shockwaveActive = false;

    // Track mouse across the entire hero / screen without boundaries
    window.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      if (e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40) {
        const hx = e.clientX - rect.left;
        const hy = e.clientY - rect.top;

        isMouseInside = true;
        mouseClientX = hx;
        mouseClientY = hy;

        // Full freedom of movement across 100% of the screen width and height
        targetX = Math.max(0, Math.min(width, hx));
        targetY = Math.max(0, Math.min(height, hy));

        // Compute mouse velocity impulse for 3D rotation
        const dx = hx - prevMouseX;
        const dy = hy - prevMouseY;
        rotVelY += dx * 0.0004;
        rotVelX -= dy * 0.0004;
        prevMouseX = hx;
        prevMouseY = hy;
      } else {
        isMouseInside = false;
        targetX = width * 0.55;
        targetY = height * 0.48;
      }
    }, { passive: true });

    window.addEventListener('click', (e) => {
      const rect = hero.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        shockwaveActive = true;
        shockwaveRadius = 10;
      }
    });

    // Auto-pause when hero is scrolled out of viewport
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isVisible = entry.isIntersecting;
          if (isVisible && !rafId) {
            render();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(hero);
    }

    let rafId = null;
    let tick = 0;

    const render = () => {
      if (!isVisible) {
        rafId = null;
        return;
      }

      tick++;

      // Smooth spring inertia tracking towards mouse cursor
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      // Ambient floating levitation
      const hoverOscX = Math.sin(tick * 0.016) * 8;
      const hoverOscY = Math.cos(tick * 0.012) * 12;
      const sphereCenterX = currentX + hoverOscX;
      const sphereCenterY = currentY + hoverOscY;

      // Damped rotation with ambient drift
      rotVelX *= 0.94;
      rotVelY *= 0.94;
      rotY += rotVelY + 0.0035;
      rotX += rotVelX + 0.0016;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Radial shockwave on click
      if (shockwaveActive) {
        shockwaveRadius += 10;
        if (shockwaveRadius > SPHERE_RADIUS * 2.6) {
          shockwaveActive = false;
          shockwaveRadius = 0;
        }
      }

      ctx.clearRect(0, 0, width, height);

      const focalLength = 340;

      // Update and project particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        // 3D rotation Y
        const x1 = p.origX * cosY - p.origZ * sinY;
        const z1 = p.origZ * cosY + p.origX * sinY;

        // 3D rotation X
        const y2 = p.origY * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.origY * sinX;
        const x2 = x1;

        const px = x2 + p.dispX;
        const py = y2 + p.dispY;
        const pz = z2 + p.dispZ;

        const scale = focalLength / (focalLength + pz + SPHERE_RADIUS * 0.8);
        const screenX = sphereCenterX + px * scale;
        const screenY = sphereCenterY + py * scale;

        // Antigravity cursor repulsion
        if (isMouseInside) {
          const mdx = screenX - mouseClientX;
          const mdy = screenY - mouseClientY;
          const distToMouse = Math.sqrt(mdx * mdx + mdy * mdy);
          const repulseDist = 135;

          if (distToMouse < repulseDist && distToMouse > 0.001) {
            const force = Math.pow(1 - distToMouse / repulseDist, 2) * 38;
            p.dispX += (mdx / distToMouse) * force;
            p.dispY += (mdy / distToMouse) * force;
          }
        }

        // Shockwave displacement
        if (shockwaveActive) {
          const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
          const waveDiff = Math.abs(distFromCenter - shockwaveRadius);
          if (waveDiff < 28) {
            const waveForce = (1 - waveDiff / 28) * 20;
            const norm = distFromCenter > 0 ? waveForce / distFromCenter : 0;
            p.dispX += px * norm;
            p.dispY += py * norm;
            p.dispZ += pz * norm;
          }
        }

        // Spring return to spherical surface
        p.dispX *= 0.88;
        p.dispY *= 0.88;
        p.dispZ *= 0.88;

        p.projX = screenX;
        p.projY = screenY;
        p.projZ = pz;
        p.projScale = scale;
      }

      // Sort by depth for correct blending
      particles.sort((a, b) => a.projZ - b.projZ);

      // Ambient radial back glow
      const auraGrad = ctx.createRadialGradient(
        sphereCenterX,
        sphereCenterY,
        SPHERE_RADIUS * 0.2,
        sphereCenterX,
        sphereCenterY,
        SPHERE_RADIUS * 1.45
      );
      auraGrad.addColorStop(0, 'rgba(43, 112, 240, 0.16)');
      auraGrad.addColorStop(0.5, 'rgba(37, 99, 235, 0.05)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(sphereCenterX, sphereCenterY, SPHERE_RADIUS * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Constellation lines for front-facing particles
      ctx.lineWidth = 0.65;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p1 = particles[i];
        if (p1.projZ < 0) continue;

        for (let j = i + 1; j < Math.min(i + 8, PARTICLE_COUNT); j++) {
          const p2 = particles[j];
          if (p2.projZ < 0) continue;

          const ddx = p1.projX - p2.projX;
          const ddy = p1.projY - p2.projY;
          const lineDist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (lineDist < 36) {
            const lineAlpha = (1 - lineDist / 36) * 0.28 * (p1.projZ / SPHERE_RADIUS);
            ctx.strokeStyle = `rgba(96, 165, 250, ${Math.max(0, lineAlpha)})`;
            ctx.beginPath();
            ctx.moveTo(p1.projX, p1.projY);
            ctx.lineTo(p2.projX, p2.projY);
            ctx.stroke();
          }
        }
      }

      // Draw particles with depth-attenuated glow (zero shadowBlur overhead)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        const zNorm = (p.projZ + SPHERE_RADIUS) / (SPHERE_RADIUS * 2);
        const alpha = Math.max(0.12, Math.min(0.95, 0.15 + zNorm * 0.8));
        const radius = Math.max(0.8, p.baseSize * p.projScale * (0.6 + zNorm * 0.7));

        if (zNorm > 0.65) {
          // Soft glowing halo for prominent front particles
          ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.25})`;
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, radius * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Crisp luminous particle core
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${zNorm > 0.55 ? alpha : alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    render();
  };

  // --- BUNDLES RENDERER & 1-CLICK ADD ---
  const renderBundles = () => {
    const container = document.getElementById('bundlesGrid');
    if (!container || !GEEKNOOK_DATA.bundles) return;

    container.innerHTML = GEEKNOOK_DATA.bundles.map(b => `
      <div class="bundle-card">
        <div class="bundle-badge-ribbon">${escapeHTML(b.badge)}</div>
        <div class="bundle-card-img-wrap">
          <img src="${toAssetUrl(b.image)}" alt="${escapeHTML(b.title)}" class="bundle-card-img" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=toAssetUrl('images/tild3763-3337-4662-b233-616531316364__3.jpg')" />
        </div>
        <div class="bundle-card-body">
          <h3 class="bundle-card-title">${escapeHTML(b.title)}</h3>
          <p class="bundle-card-sub">${escapeHTML(b.subtitle)}</p>
          <ul class="bundle-items-checklist">
            ${b.items.map(item => `
              <li class="bundle-item-line">
                <svg class="bundle-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>${escapeHTML(item)}</span>
              </li>
            `).join('')}
          </ul>
          <div class="bundle-footer-row">
            <div class="bundle-prices-col">
              <span class="bundle-old-price">${formatPrice(b.oldPrice)}</span>
              <span class="bundle-current-price">${formatPrice(b.price)}</span>
              <span class="bundle-savings-tag">${escapeHTML(b.savings)}</span>
            </div>
            <button type="button" class="btn-bundle-buy" onclick="window.geekNookApp.addBundleToCart('${b.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              <span>В корзину</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  };

  const addBundleToCart = (bundleId) => {
    const bundle = GEEKNOOK_DATA.bundles?.find(b => b.id === bundleId);
    if (!bundle) {
      showToast('Комплект не найден', 'error');
      return;
    }

    soundEngine.play('cart');

    const cartKey = `bundle_${bundle.id}`;
    const existing = state.cart.find(i => i.cartKey === cartKey);

    if (existing) {
      existing.quantity = Math.min(99, (parseInt(existing.quantity, 10) || 1) + 1);
    } else {
      state.cart.push({
        cartKey,
        id: bundle.id,
        title: bundle.title,
        option: `Комплект (${bundle.items.length} предм.)`,
        price: bundle.price,
        image: bundle.image,
        quantity: 1
      });
    }

    saveCart();
    triggerBadgeBounce();
    showToast(`Комплект «${bundle.title}» добавлен в корзину со скидкой!`, 'success');
    openCartDrawer();
  };

  // --- BEFORE & AFTER TRANSFORMATION SLIDER ---
  const setTransformationSlider = (percent) => {
    const slider = document.getElementById('beforeAfterSlider');
    if (!slider) return 50;
    const clamped = Math.max(5, Math.min(95, Number(percent) || 50));
    slider.style.setProperty('--ba-pos', `${clamped}%`);
    return clamped;
  };

  const initBeforeAfterSlider = () => {
    const slider = document.getElementById('beforeAfterSlider');
    if (!slider) return;

    let isDragging = false;

    const setPositionFromEvent = (e) => {
      const rect = slider.getBoundingClientRect();
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      if (clientX === null) return;
      let percent = ((clientX - rect.left) / rect.width) * 100;
      setTransformationSlider(percent);
    };

    const startDrag = (e) => {
      isDragging = true;
      setPositionFromEvent(e);
      soundEngine.play('click');
    };

    const stopDrag = () => {
      isDragging = false;
    };

    const onDrag = (e) => {
      if (!isDragging) return;
      setPositionFromEvent(e);
    };

    slider.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', stopDrag);

    slider.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);

    slider.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', onDrag, { passive: true });
    window.addEventListener('touchend', stopDrag);
  };

  // --- PRODUCTION SEQUENTIAL BLOCKS & SCROLLING & EXPLODED BLUEPRINT & FEA STRESS LAB ---
  const scrollToProductionBlock = (blockId) => {
    soundEngine.play('click');
    const mapping = {
      'photos': 'productionPhotosView',
      '3d': 'production3dStudioView',
      'blueprint': 'productionExplodedView',
      'stress': 'productionStressView'
    };
    const targetId = mapping[blockId] || blockId;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const yOffset = -90;
      const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }

    document.querySelectorAll('.production-view-tabs .prod-tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = Array.from(document.querySelectorAll('.production-view-tabs .prod-tab-btn')).find(b => {
      const fn = b.getAttribute('onclick') || '';
      return fn.includes(`'${blockId}'`);
    });
    if (activeBtn) activeBtn.classList.add('active');

    if (blockId === '3d' && !production3DStudio.isInitialized) {
      production3DStudio.init();
    } else if (blockId === 'stress') {
      initFeaLab();
    }
  };

  const switchProductionTab = (tab = 'photos') => {
    scrollToProductionBlock(tab);
  };

  const toggleHotspot = (btn) => {
    const hotspot = btn.closest('.blueprint-hotspot');
    if (!hotspot) return;
    const wasActive = hotspot.classList.contains('active');
    document.querySelectorAll('.blueprint-hotspot.active').forEach(h => h.classList.remove('active'));
    if (!wasActive) {
      hotspot.classList.add('active');
      soundEngine.play('click');
    }
  };

  // --- 1. FEA STRESS TEST & SOLID MECHANICS LAB ---
  const feaState = {
    weightKg: 25,
    isShockTesting: false,
    shockStartTime: 0
  };

  const calculateFeaPhysics = (weightKg) => {
    const mass = Math.max(0, Math.min(85, Number(weightKg) || 0));
    const g = 9.81;
    const F = mass * g;
    const Leff = 0.72; // effective span between leg brackets
    const E = 12.5e9;  // Caucasian oak modulus 12.5 GPa
    const b = 0.23;    // beam width 230mm
    const h = 0.022;   // thickness 22mm
    const I = (b * Math.pow(h, 3)) / 12;

    const deltaMeters = (F * Math.pow(Leff, 3)) / (48 * E * I);
    const deltaMm = deltaMeters * 1000;

    const Mmax = (F * Leff) / 4;
    const sigmaPa = (Mmax * (h / 2)) / I;
    const sigmaMpa = sigmaPa / 1e6;

    const yieldStrengthMpa = 85.0;
    const safetyFactor = sigmaMpa > 0.1 ? (yieldStrengthMpa / sigmaMpa) : 99.9;

    return {
      mass,
      F,
      deltaMm: Number(deltaMm.toFixed(2)),
      sigmaMpa: Number(sigmaMpa.toFixed(1)),
      safetyFactor: Number(safetyFactor.toFixed(1))
    };
  };

  let feaAnimationReq = null;

  const renderFeaCanvas = () => {
    const canvas = document.getElementById('feaStressCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width || 900;
    const h = 260;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Technical coordinate grid (millimeter rule background)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const { mass, deltaMm } = calculateFeaPhysics(feaState.weightKg);

    const beamY = 110;
    const beamHeight = 30;
    const padL = 90;
    const padR = w - 90;
    const beamW = padR - padL;
    const legW = 36;
    const legH = 80;

    // Draw Aircraft Aluminum D16T legs with bevels and Portuguese cork pads
    const drawLeg = (lx) => {
      // Cork foot pad (Portugal granulated cork with subtle texture)
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(lx - 2, beamY + beamHeight + legH - 10, legW + 4, 10);
      ctx.fillStyle = '#b45309';
      for (let cx = lx; cx < lx + legW; cx += 5) {
        ctx.fillRect(cx + (cx % 3), beamY + beamHeight + legH - 8, 2, 2);
      }

      // Aluminum leg bracket (D16T satin anodized)
      const legGrad = ctx.createLinearGradient(lx, 0, lx + legW, 0);
      legGrad.addColorStop(0, '#1e293b');
      legGrad.addColorStop(0.25, '#475569');
      legGrad.addColorStop(0.5, '#64748b');
      legGrad.addColorStop(0.75, '#334155');
      legGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = legGrad;
      ctx.fillRect(lx, beamY + beamHeight, legW, legH - 10);

      // Chamfer stroke
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(lx, beamY + beamHeight, legW, legH - 10);

      // Hex mounting bolt M5
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(lx + legW / 2, beamY + beamHeight + 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    drawLeg(padL + 18);
    drawLeg(padR - 18 - legW);

    // Shock impulse vibration calculation
    let vibrationDelta = 0;
    const elapsedShock = feaState.shockStartTime ? (performance.now() - feaState.shockStartTime) / 1000 : 999;
    if (feaState.isShockTesting) {
      if (elapsedShock < 0.55) {
        // 25 Hz oscillation damped by cork with exponential decay
        vibrationDelta = Math.sin(elapsedShock * Math.PI * 2 * 25) * Math.exp(-elapsedShock * 9.2) * 20;
      } else {
        feaState.isShockTesting = false;
      }
    }

    const visualDeflection = (deltaMm * 18) + vibrationDelta;

    // Finite Elements: 56 slices along length x 8 vertical thickness layers
    const numSlices = 56;
    const numLayers = 8;
    const sliceWidth = beamW / numSlices;

    for (let i = 0; i < numSlices; i++) {
      const xNorm = (i + 0.5) / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;

      for (let j = 0; j < numLayers; j++) {
        const yNorm = (j / (numLayers - 1)) * 2 - 1; // -1 (top compression) to +1 (bottom tension)
        const cellX = padL + i * sliceWidth;
        const cellY = beamY + (j * (beamHeight / numLayers)) + currDeflection;
        const cellH = (beamHeight / numLayers) + 0.6;

        // Stress profile: compression on top, tension on bottom
        const stressRatio = -yNorm * flexShape * Math.min(1, mass / 70);

        let color = '#10b981';
        if (stressRatio > 0.05) {
          const blueIntensity = Math.min(1, stressRatio * 1.6);
          color = `rgb(${Math.round(29 * (1 - blueIntensity))}, ${Math.round(78 + 90 * (1 - blueIntensity))}, ${Math.round(216 * blueIntensity + 100)})`;
        } else if (stressRatio < -0.05) {
          const redIntensity = Math.min(1, -stressRatio * 1.6);
          color = `rgb(${Math.round(239 * redIntensity + 16 * (1 - redIntensity))}, ${Math.round(185 * (1 - redIntensity * 0.7))}, 30)`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(cellX, cellY, sliceWidth + 0.6, cellH);
      }
    }

    // Top surface curve highlight (clearcoat reflection)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= numSlices; i++) {
      const xNorm = i / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;
      const px = padL + i * sliceWidth;
      const py = beamY + currDeflection;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Neutral axis dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= numSlices; i++) {
      const xNorm = i / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;
      const px = padL + i * sliceWidth;
      const py = beamY + (beamHeight / 2) + currDeflection;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Force vector and pulsating target ring
    if (mass > 0) {
      const centerX = w / 2;
      const centerY = beamY + visualDeflection;
      const arrowLen = 32 + Math.min(45, mass * 0.5);

      // Radar target ring on surface
      const pulseR = 9 + Math.sin(performance.now() * 0.006) * 3;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.fillStyle = '#f59e0b';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY - arrowLen);
      ctx.lineTo(centerX, centerY - 6);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY - 14);
      ctx.lineTo(centerX + 6, centerY - 14);
      ctx.lineTo(centerX, centerY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText(`F = ${(mass * 9.81).toFixed(0)} N (${mass} кг)`, centerX, centerY - arrowLen - 8);
    }

    // High-Tech Vibration Oscilloscope in top-right corner
    const oscW = 210;
    const oscH = 75;
    const oscX = w - oscW - 14;
    const oscY = 12;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(oscX, oscY, oscW, oscH, 8) : ctx.rect(oscX, oscY, oscW, oscH);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Phosphor grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 0.75;
    for (let gx = oscX + 26; gx < oscX + oscW; gx += 26) {
      ctx.beginPath(); ctx.moveTo(gx, oscY + 18); ctx.lineTo(gx, oscY + oscH - 6); ctx.stroke();
    }
    for (let gy = oscY + 22; gy < oscY + oscH; gy += 18) {
      ctx.beginPath(); ctx.moveTo(oscX + 6, gy); ctx.lineTo(oscX + oscW - 6, gy); ctx.stroke();
    }

    // Oscilloscope Header
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText('OSCILLOSCOPE // 25Hz CORK DAMPING', oscX + 8, oscY + 13);
    ctx.textAlign = 'right';
    ctx.fillStyle = feaState.isShockTesting ? '#ef4444' : '#10b981';
    ctx.fillText(feaState.isShockTesting ? '● SAMPLING' : '● DAMPED', oscX + oscW - 8, oscY + 13);

    // Waveform curve
    const midY = oscY + 45;
    const oscPlotW = oscW - 20;
    ctx.beginPath();
    ctx.strokeStyle = feaState.isShockTesting ? '#38bdf8' : '#10b981';
    ctx.lineWidth = 1.5;
    for (let ox = 0; ox <= oscPlotW; ox++) {
      const tSec = (ox / oscPlotW) * 0.45;
      const amp = Math.sin(tSec * Math.PI * 2 * 25) * Math.exp(-tSec * 9.5) * 20;
      const px = oscX + 10 + ox;
      const py = midY + amp;
      if (ox === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Sweep dot cursor if shock test active
    if (feaState.isShockTesting && elapsedShock < 0.45) {
      const dotX = oscX + 10 + (elapsedShock / 0.45) * oscPlotW;
      const dotY = midY + Math.sin(elapsedShock * Math.PI * 2 * 25) * Math.exp(-elapsedShock * 9.5) * 20;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oscilloscope footer
    ctx.font = '8px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('ζ = 0.38 (Пробка 2мм)', oscX + 10, oscY + oscH - 4);
    ctx.textAlign = 'right';
    ctx.fillText('Время: 0.14 с', oscX + oscW - 10, oscY + oscH - 4);

    if (feaState.isShockTesting) {
      feaAnimationReq = requestAnimationFrame(renderFeaCanvas);
    }
  };

  const updateFeaWeight = (val) => {
    feaState.weightKg = Number(val);
    const { deltaMm, sigmaMpa, safetyFactor } = calculateFeaPhysics(feaState.weightKg);

    const weightDisplay = document.getElementById('feaWeightDisplay');
    const slider = document.getElementById('feaWeightSlider');
    const deflEl = document.getElementById('feaDeflectionVal');
    const stressEl = document.getElementById('feaStressVal');
    const safetyEl = document.getElementById('feaSafetyVal');

    if (slider && Number(slider.value) !== feaState.weightKg) slider.value = feaState.weightKg;

    if (weightDisplay) {
      let desc = 'Легкая нагрузка';
      if (feaState.weightKg <= 10) desc = 'Монитор 24"';
      else if (feaState.weightKg <= 25) desc = 'Studio Display / Два экрана';
      else if (feaState.weightKg <= 50) desc = 'Два тяжелых моноблока';
      else desc = 'Вес взрослого человека';
      weightDisplay.textContent = `${feaState.weightKg} кг (${desc})`;
    }

    if (deflEl) deflEl.textContent = `${deltaMm} мм`;
    if (stressEl) stressEl.textContent = `${sigmaMpa} МПа`;
    if (safetyEl) {
      safetyEl.textContent = `${safetyFactor}x (${safetyFactor >= 4 ? 'Авиационный' : 'Стандарт'})`;
      safetyEl.style.color = safetyFactor >= 3 ? '#10b981' : '#f59e0b';
    }

    document.querySelectorAll('#feaPresetsRow .fea-preset-chip').forEach(chip => {
      const match = chip.textContent.includes(`${feaState.weightKg} кг`);
      chip.classList.toggle('active', match);
    });

    renderFeaCanvas();
  };

  const setFeaPreset = (weight) => {
    soundEngine.play('click');
    updateFeaWeight(weight);
  };

  const runFeaShockTest = () => {
    soundEngine.play('cart');
    feaState.isShockTesting = true;
    feaState.shockStartTime = performance.now();
    showToast('Дроп-тест: импульс 10 кг погашен пробковыми демпферами за 0.14 с!');
    if (feaAnimationReq) cancelAnimationFrame(feaAnimationReq);
    renderFeaCanvas();
  };

  const initFeaLab = () => {
    updateFeaWeight(feaState.weightKg);
  };

  // --- 2. GEEKNOOK 360° STEALTH CABLE MANAGEMENT & DESK WORKBENCH ---
  const cableState = {
    mode: 'magnetic', // 'magnetic' (Stealth Zen), 'chaos', 'xray'
    draggedPoint: null,
    draggedCable: null,
    mousePos: { x: 0, y: 0 },
    hoveredCable: null,
    hoveredPoint: null,
    cables: [],
    isInitialized: false,
    animFrame: null,
    devices: {
      monitor: true,
      macbook: true,
      iphone: true,
      screenbar: true
    },
    stealthProgress: 1.0, // 0 = full chaos, 1 = full stealth
    xrayProgress: 0.0,    // 0 = solid wood, 1 = blueprint glass
    keyboardProgress: 1.0,// 0 = out on desk, 1 = tucked under shelf
    snapSparks: [],
    simTick: 0
  };

  const updateCableMetrics = () => {
    const mode = cableState.mode;
    const noiseVal = document.getElementById('cableMetricNoise');
    const noiseBadge = document.getElementById('cableMetricNoiseBadge');
    const noiseDesc = document.getElementById('cableMetricNoiseDesc');

    const spaceVal = document.getElementById('cableMetricSpace');
    const spaceBadge = document.getElementById('cableMetricSpaceBadge');
    const spaceDesc = document.getElementById('cableMetricSpaceDesc');

    const hiddenVal = document.getElementById('cableMetricHidden');
    const hiddenBadge = document.getElementById('cableMetricHiddenBadge');
    const hiddenDesc = document.getElementById('cableMetricHiddenDesc');

    const holdVal = document.getElementById('cableMetricHold');
    const holdBadge = document.getElementById('cableMetricHoldBadge');
    const holdDesc = document.getElementById('cableMetricHoldDesc');

    let activeDevCount = 0;
    if (cableState.devices.monitor) activeDevCount++;
    if (cableState.devices.macbook) activeDevCount++;
    if (cableState.devices.iphone) activeDevCount++;
    if (cableState.devices.screenbar) activeDevCount++;

    if (mode === 'chaos') {
      if (noiseVal) noiseVal.textContent = '94%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Критический хаос';
        noiseBadge.className = 'cable-metric-badge badge-bad';
      }
      if (noiseDesc) noiseDesc.textContent = 'Провода хаотично разбросаны по столу, мешают мыши и создают визуальный шум';

      if (spaceVal) spaceVal.textContent = '-38%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Захламлено';
        spaceBadge.className = 'cable-metric-badge badge-bad';
      }
      if (spaceDesc) spaceDesc.textContent = 'Провода и адаптеры отнимают рабочее место перед экраном';

      if (hiddenVal) hiddenVal.textContent = `0 из ${activeDevCount}`;
      if (hiddenBadge) {
        hiddenBadge.textContent = 'Все на виду';
        hiddenBadge.className = 'cable-metric-badge badge-bad';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Кабели свисают с торца стола без какой-либо фиксации';

      if (holdVal) holdVal.textContent = '0 кгс';
      if (holdBadge) {
        holdBadge.textContent = 'Нет замка';
        holdBadge.className = 'cable-metric-badge badge-bad';
      }
      if (holdDesc) holdDesc.textContent = 'Опасность случайно задеть шнур ногой или пролить кофе';
    } else if (mode === 'xray') {
      if (noiseVal) noiseVal.textContent = '0%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Скрытая инженерия';
        noiseBadge.className = 'cable-metric-badge badge-tech';
      }
      if (noiseDesc) noiseDesc.textContent = 'Двухканальный Т-паз физически разделяет 220V и высокоскоростные линии данных';

      if (spaceVal) spaceVal.textContent = '+40%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Клиренс 90 мм';
        spaceBadge.className = 'cable-metric-badge badge-good';
      }
      if (spaceDesc) spaceDesc.textContent = 'Под полку легко помещается полноразмерная клавиатура и планшет';

      if (hiddenVal) hiddenVal.textContent = `${activeDevCount} канала`;
      if (hiddenBadge) {
        hiddenBadge.textContent = 'Экранировано';
        hiddenBadge.className = 'cable-metric-badge badge-tech';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Высокочастотные экраны кабелей исключают электромагнитные наводки';

      if (holdVal) holdVal.textContent = '4× N52';
      if (holdBadge) {
        holdBadge.textContent = 'Т-паз Д16Т';
        holdBadge.className = 'cable-metric-badge badge-tech';
      }
      if (holdDesc) holdDesc.textContent = 'Неодимовые муфты удерживают корд с силой до 12 Ньютонов';
    } else {
      // Stealth Mode (Default Zen)
      if (noiseVal) noiseVal.textContent = '0%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Идеальный Дзен';
        noiseBadge.className = 'cable-metric-badge badge-good';
      }
      if (noiseDesc) noiseDesc.textContent = 'Все провода скрыты под полкой в алюминиевом профиле Т-паза';

      if (spaceVal) spaceVal.textContent = '+40%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Клавиатура спрятана';
        spaceBadge.className = 'cable-metric-badge badge-good';
      }
      if (spaceDesc) spaceDesc.textContent = 'Клавиатура и мышь легко убираются в нишу под подставку (90 мм)';

      if (hiddenVal) hiddenVal.textContent = `${activeDevCount} из ${activeDevCount}`;
      if (hiddenBadge) {
        hiddenBadge.textContent = '100% Stealth';
        hiddenBadge.className = 'cable-metric-badge badge-good';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Кабели питания, Thunderbolt 4 и MagSafe полностью невидимы';

      if (holdVal) holdVal.textContent = '4× N52';
      if (holdBadge) {
        holdBadge.textContent = '1.2 кг на отрыв';
        holdBadge.className = 'cable-metric-badge badge-good';
      }
      if (holdDesc) holdDesc.textContent = 'Неодимовые фиксаторы надежно удерживают кабели в желобе';
    }
  };

  const toggleCableDevice = (deviceId) => {
    if (!cableState.devices.hasOwnProperty(deviceId)) return;
    cableState.devices[deviceId] = !cableState.devices[deviceId];
    soundEngine.play('click');

    const btnIdMap = {
      monitor: 'devToggleMonitor',
      macbook: 'devToggleMacbook',
      iphone: 'devToggleIPhone',
      screenbar: 'devToggleScreenbar'
    };

    const btn = document.getElementById(btnIdMap[deviceId]);
    if (btn) {
      btn.classList.toggle('active', cableState.devices[deviceId]);
    }

    const titles = {
      monitor: 'Studio Display 5K',
      macbook: 'MacBook Pro M3',
      iphone: 'iPhone MagSafe Stand',
      screenbar: 'Лампа ScreenBar'
    };

    showToast(`${titles[deviceId]}: ${cableState.devices[deviceId] ? 'подключен к сетапу' : 'отключен'}`);
    updateCableMetrics();
  };

  const initCableSimulator = () => {
    const canvas = document.getElementById('cablePhysicsCanvas');
    if (!canvas || cableState.isInitialized) return;
    cableState.isInitialized = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 1200;
    let height = 540;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // 4 Authentic Setup Cables
    const cableConfigs = [
      {
        id: 'tb4',
        device: 'macbook',
        name: 'Thunderbolt 4 Pro (MacBook M3)',
        color: '#334155',
        weaveColor: '#64748b',
        sheenColor: 'rgba(56, 189, 248, 0.6)',
        photonColor: '#38bdf8',
        width: 6.5,
        ledColor: '#38bdf8',
        spec: '40 Gbps // 100W PD // Оплетка Kevlar // Ø6.5mm',
        segs: 26,
        // Relative anchors
        getChaosTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const mbW = (isMob ? 85 : 100) * sc;
          const mbX = isMob ? (sX - mbW - 8) : (sX - 85);
          const p0 = { x: mbX + mbW - 2, y: h * (isMob ? 0.54 : 0.62) };
          const pEnd = { x: w * 0.44, y: sY + 16 };
          return [p0, { x: sX + 10, y: h * 0.72 }, { x: w * 0.35, y: h * 0.80 }, { x: w * 0.40, y: h * 0.68 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const mbW = (isMob ? 85 : 100) * sc;
          const mbX = isMob ? (sX - mbW - 8) : (sX - 85);
          const p0 = { x: mbX + mbW - 2, y: h * (isMob ? 0.54 : 0.62) };
          const p1 = { x: sX - 6, y: sY + 18 };
          const pEnd = { x: sX + sW * 0.22, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      },
      {
        id: 'display',
        device: 'monitor',
        name: 'DisplayPort 2.1 (Studio Display 5K)',
        color: '#0f172a',
        weaveColor: '#1e293b',
        sheenColor: 'rgba(251, 191, 36, 0.6)',
        photonColor: '#fbbf24',
        width: 7.0,
        ledColor: '#fbbf24',
        spec: '5K Retina @ 120Hz // 80 Gbps // Экранирован // Ø7.0mm',
        segs: 24,
        getChaosTargets: (w, h, sX, sW, sY) => {
          // Drooping messily behind monitor and pooling onto tabletop
          const p0 = { x: w * 0.50, y: sY - 40 };
          const pEnd = { x: w * 0.48, y: sY + 36 };
          return [p0, { x: w * 0.53, y: sY + 12 }, { x: w * 0.55, y: h * 0.66 }, { x: w * 0.51, y: h * 0.68 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          // Perfectly straight drop behind the monitor stand into slot 2
          const p0 = { x: w * 0.50, y: sY - 40 };
          const pEnd = { x: w * 0.50, y: sY + 16 };
          return [p0, pEnd];
        }
      },
      {
        id: 'magsafe',
        device: 'iphone',
        name: 'MagSafe 3 Fast Charge (iPhone Stand)',
        color: '#e2e8f0',
        weaveColor: '#cbd5e1',
        sheenColor: 'rgba(16, 185, 129, 0.7)',
        photonColor: '#10b981',
        width: 4.8,
        ledColor: '#10b981',
        spec: '140W Qi2 Fast Charge // Силикон // Ø4.8mm',
        segs: 24,
        getChaosTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const phW = 32 * sc;
          const phX = isMob ? (sX + sW + 8 + phW / 2) : (sX + sW + 45);
          const p0 = { x: phX, y: h * (isMob ? 0.54 : 0.64) };
          const pEnd = { x: sX + sW * 0.78, y: sY + 16 };
          return [p0, { x: sX + sW + 6, y: h * 0.74 }, { x: sX + sW - 15, y: h * 0.78 }, { x: sX + sW - 30, y: h * 0.65 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const phW = 32 * sc;
          const phX = isMob ? (sX + sW + 8 + phW / 2) : (sX + sW + 45);
          const p0 = { x: phX, y: h * (isMob ? 0.54 : 0.64) };
          const p1 = { x: sX + sW + 6, y: sY + 18 };
          const pEnd = { x: sX + sW * 0.78, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      },
      {
        id: 'power',
        device: 'monitor',
        name: 'AC Mains 220V (Блок питания)',
        color: '#18181b',
        weaveColor: '#27272a',
        sheenColor: 'rgba(249, 115, 22, 0.5)',
        photonColor: '#f97316',
        width: 8.5,
        ledColor: '#f97316',
        spec: '220V 16A Заземление // Скрытый лоток-ложемент // Ø8.5mm',
        segs: 28,
        getChaosTargets: (w, h, sX, sW, sY) => {
          // Ugly dangling cord to the floor with power brick
          const p0 = { x: w * 0.08, y: h - 25 };
          const pEnd = { x: w * 0.38, y: sY + 16 };
          return [p0, { x: w * 0.16, y: h - 45 }, { x: w * 0.22, y: h * 0.70 }, { x: w * 0.30, y: sY + 35 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          // Concealed vertical run along the back leg into rear cradle
          const p0 = { x: w * 0.08, y: h - 25 };
          const p1 = { x: sX + 24, y: h * 0.58 };
          const pEnd = { x: sX + sW * 0.38, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      }
    ];

    const buildCables = () => {
      const isMobile = width < 640;
      const shelfW = isMobile ? Math.min(width * 0.58, 300) : Math.min(Math.max(width * 0.60, 480), 760);
      const shelfX = (width - shelfW) / 2;
      const shelfY = height * 0.42;

      cableState.cables = cableConfigs.map(cfg => {
        const isChaos = cableState.mode === 'chaos';
        const rawPoints = isChaos
          ? cfg.getChaosTargets(width, height, shelfX, shelfW, shelfY)
          : cfg.getStealthTargets(width, height, shelfX, shelfW, shelfY);

        // Generate smooth sampled points
        const points = [];
        const n = cfg.segs;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const idx = t * (rawPoints.length - 1);
          const i0 = Math.floor(idx);
          const i1 = Math.min(i0 + 1, rawPoints.length - 1);
          const frac = idx - i0;

          const px = rawPoints[i0].x + (rawPoints[i1].x - rawPoints[i0].x) * frac;
          const py = rawPoints[i0].y + (rawPoints[i1].y - rawPoints[i0].y) * frac;

          points.push({
            x: px,
            y: py,
            oldX: px,
            oldY: py,
            targetX: px,
            targetY: py,
            pinned: i === 0 || i === n
          });
        }

        const constraints = [];
        for (let i = 0; i < n; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          constraints.push({ p1, p2, length: len });
        }

        return { ...cfg, points, constraints };
      });
    };
    buildCables();

    // Resize rebuild
    window.addEventListener('resize', () => {
      resize();
      buildCables();
    }, { passive: true });

    // Interactive pointer handling with cached rect (zero layout thrashing)
    let cachedCanvasRect = null;
    const updateCanvasRect = () => {
      if (canvas) cachedCanvasRect = canvas.getBoundingClientRect();
    };

    window.addEventListener('resize', () => { cachedCanvasRect = null; }, { passive: true });
    window.addEventListener('scroll', () => { cachedCanvasRect = null; }, { passive: true });

    const getPos = (e) => {
      if (!cachedCanvasRect) updateCanvasRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - (cachedCanvasRect ? cachedCanvasRect.left : 0),
        y: clientY - (cachedCanvasRect ? cachedCanvasRect.top : 0)
      };
    };

    canvas.addEventListener('mousedown', (e) => {
      updateCanvasRect();
      const pos = getPos(e);
      cableState.mousePos = pos;
      let closest = null;
      let closestCable = null;
      let minDist = 40;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          if (p.pinned) return;
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minDist) {
            minDist = d;
            closest = p;
            closestCable = c;
          }
        });
      });

      cableState.draggedPoint = closest;
      cableState.draggedCable = closestCable;
      if (closest) soundEngine.play('click');
    });

    window.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      cableState.mousePos = pos;

      let hovered = null;
      let hoveredPt = null;
      let minHovDist = 32;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minHovDist) {
            minHovDist = d;
            hovered = c;
            hoveredPt = p;
          }
        });
      });

      cableState.hoveredCable = hovered;
      cableState.hoveredPoint = hoveredPt;
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      if (cableState.draggedPoint && cableState.draggedCable) {
        // If pulled near shelf T-track in Stealth or X-ray, trigger magnetic SNAP
        const shelfY = height * 0.42;
        if (cableState.mode !== 'chaos' && Math.abs(cableState.draggedPoint.y - (shelfY + 18)) < 60) {
          soundEngine.play('snap');
          // Emit spark burst
          for (let s = 0; s < 8; s++) {
            cableState.snapSparks.push({
              x: cableState.draggedPoint.x,
              y: cableState.draggedPoint.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              life: 1.0,
              color: '#38bdf8'
            });
          }
          showToast(`${cableState.draggedCable.name} зафиксирован в Т-пазе N52`);
        }
      }
      cableState.draggedPoint = null;
      cableState.draggedCable = null;
    });

    canvas.addEventListener('touchstart', (e) => {
      updateCanvasRect();
      const pos = getPos(e);
      cableState.mousePos = pos;
      let closest = null;
      let closestCable = null;
      let minDist = 48;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          if (p.pinned) return;
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minDist) {
            minDist = d;
            closest = p;
            closestCable = c;
          }
        });
      });

      cableState.draggedPoint = closest;
      cableState.draggedCable = closestCable;
      if (closest) soundEngine.play('click');
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!cableState.draggedPoint) return;
      if (e.cancelable) e.preventDefault();
      cableState.mousePos = getPos(e);
    }, { passive: false });

    window.addEventListener('touchend', () => {
      cableState.draggedPoint = null;
      cableState.draggedCable = null;
      cableState.hoveredCable = null;
      cableState.hoveredPoint = null;
    });

    // Main Simulation & Rendering Loop
    const stepPhysics = () => {
      cableState.simTick++;
      const isChaos = cableState.mode === 'chaos';
      const isXray = cableState.mode === 'xray';

      // Transition progress easing
      const targetStealth = isChaos ? 0 : 1;
      cableState.stealthProgress += (targetStealth - cableState.stealthProgress) * 0.12;

      const targetXray = isXray ? 1 : 0;
      cableState.xrayProgress += (targetXray - cableState.xrayProgress) * 0.12;

      const targetKeyboard = isChaos ? 0 : 1;
      cableState.keyboardProgress += (targetKeyboard - cableState.keyboardProgress) * 0.08;

      const isMobile = width < 640;
      const uiScale = isMobile ? Math.max(0.55, Math.min(0.85, width / 520)) : 1.0;
      const shelfW = isMobile ? Math.min(width * 0.58, 300) : Math.min(Math.max(width * 0.60, 480), 760);
      const shelfX = (width - shelfW) / 2;
      const shelfY = height * 0.42;

      // Update Cable target interpolation and physics
      cableState.cables.forEach(cable => {
        if (!cableState.devices[cable.device]) return;

        const chaosTargets = cable.getChaosTargets(width, height, shelfX, shelfW, shelfY);
        const stealthTargets = cable.getStealthTargets(width, height, shelfX, shelfW, shelfY);
        const n = cable.points.length - 1;

        cable.points.forEach((p, idx) => {
          if (p === cableState.draggedPoint) {
            p.x = cableState.mousePos.x;
            p.y = cableState.mousePos.y;
            p.oldX = p.x;
            p.oldY = p.y;
            return;
          }

          const t = idx / n;

          // Chaos target
          const cIdx = t * (chaosTargets.length - 1);
          const ci0 = Math.floor(cIdx);
          const ci1 = Math.min(ci0 + 1, chaosTargets.length - 1);
          const cFrac = cIdx - ci0;
          const cx = chaosTargets[ci0].x + (chaosTargets[ci1].x - chaosTargets[ci0].x) * cFrac;
          const cy = chaosTargets[ci0].y + (chaosTargets[ci1].y - chaosTargets[ci0].y) * cFrac;

          // Stealth target
          const sIdx = t * (stealthTargets.length - 1);
          const si0 = Math.floor(sIdx);
          const si1 = Math.min(si0 + 1, stealthTargets.length - 1);
          const sFrac = sIdx - si0;
          const sx = stealthTargets[si0].x + (stealthTargets[si1].x - stealthTargets[si0].x) * sFrac;
          const sy = stealthTargets[si0].y + (stealthTargets[si1].y - stealthTargets[si0].y) * sFrac;

          // Blend targets based on stealthProgress
          const tx = cx + (sx - cx) * cableState.stealthProgress;
          const ty = cy + (sy - cy) * cableState.stealthProgress;

          if (isChaos) {
            // In chaos: springy Verlet physics
            let vx = (p.x - p.oldX) * 0.96;
            let vy = (p.y - p.oldY) * 0.96;
            p.oldX = p.x;
            p.oldY = p.y;
            p.x += vx + (tx - p.x) * 0.08;
            p.y += vy + (ty - p.y) * 0.08 + 0.15; // gravity
          } else {
            // In stealth/x-ray: smooth magnetic rail lock
            p.x += (tx - p.x) * 0.18;
            p.y += (ty - p.y) * 0.18;
            p.oldX = p.x;
            p.oldY = p.y;
          }
        });

        // Verlet constraint relaxation (2 passes)
        if (isChaos) {
          for (let iter = 0; iter < 2; iter++) {
            cable.constraints.forEach(c => {
              const dx = c.p2.x - c.p1.x;
              const dy = c.p2.y - c.p1.y;
              const curDist = Math.hypot(dx, dy) || 1;
              const delta = (curDist - c.length) / curDist;
              if (!c.p1.pinned && c.p1 !== cableState.draggedPoint) {
                c.p1.x += dx * 0.4 * delta;
                c.p1.y += dy * 0.4 * delta;
              }
              if (!c.p2.pinned && c.p2 !== cableState.draggedPoint) {
                c.p2.x -= dx * 0.4 * delta;
                c.p2.y -= dy * 0.4 * delta;
              }
            });
          }
        }
      });

      // --- RENDERING CANVAS SCENE ---
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Studio Ambient Wall Backdrop & Grid
      const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
      wallGrad.addColorStop(0, '#0c1017');
      wallGrad.addColorStop(0.45, '#131822');
      wallGrad.addColorStop(1, '#090d14');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, width, height);

      // Fine architectural grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Soft ScreenBar task light glow cone
      if (cableState.devices.screenbar) {
        const lightGrad = ctx.createRadialGradient(width * 0.50, height * 0.16, 20, width * 0.50, height * 0.55, 340);
        lightGrad.addColorStop(0, 'rgba(254, 243, 199, 0.12)');
        lightGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.04)');
        lightGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(width * 0.50 - 90, height * 0.18);
        ctx.lineTo(width * 0.50 + 90, height * 0.18);
        ctx.lineTo(width * 0.50 + 320, height * 0.85);
        ctx.lineTo(width * 0.50 - 320, height * 0.85);
        ctx.closePath();
        ctx.fill();
      }

      // 2. The Executive Tabletop (Wood surface in perspective)
      const tableY = height * 0.44;
      const deskBottom = height - 20;

      // Tabletop Wood Gradient
      const deskGrad = ctx.createLinearGradient(0, tableY, 0, deskBottom);
      deskGrad.addColorStop(0, '#1c2430');
      deskGrad.addColorStop(0.3, '#222c3b');
      deskGrad.addColorStop(0.85, '#161c27');
      deskGrad.addColorStop(1, '#0e1219');
      ctx.fillStyle = deskGrad;
      ctx.beginPath();
      ctx.moveTo(0, tableY);
      ctx.lineTo(width, tableY);
      ctx.lineTo(width, deskBottom);
      ctx.lineTo(0, deskBottom);
      ctx.closePath();
      ctx.fill();

      // Front Chamfer Bevel of Desk
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(0, deskBottom, width, 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, deskBottom); ctx.lineTo(width, deskBottom); ctx.stroke();

      // Wood Grain Lines on Tabletop
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let gy = tableY + 20; gy < deskBottom; gy += 18) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(width * 0.3, gy + 3, width * 0.7, gy - 2, width, gy + 1);
        ctx.stroke();
      }

      // 3. Felt Wool Desk Mat
      const matW = Math.min(width * 0.72, 840);
      const matX = (width - matW) / 2;
      const matY = tableY + 35;
      const matH = deskBottom - matY - 14;

      // Soft drop shadow without expensive shadowBlur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(matX, matY + 4, matW, matH + 4, 10) : ctx.rect(matX, matY + 4, matW, matH + 4);
      ctx.fill();

      // Felt mat body
      ctx.fillStyle = '#171c26';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(matX, matY, matW, matH, 8) : ctx.rect(matX, matY, matW, matH);
      ctx.fill();

      // Mat stitch line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(matX + 4, matY + 4, matW - 8, matH - 8);
      ctx.setLineDash([]);

      // 4. Wall Outlet & Power Brick (Bottom Left)
      const wallX = width * 0.08;
      const wallY = height - 28;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wallX - 16, wallY - 12, 32, 24, 4) : ctx.rect(wallX - 16, wallY - 12, 32, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(wallX - 6, wallY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(wallX + 6, wallY, 3, 0, Math.PI * 2); ctx.fill();

      // In Chaos mode: heavy power brick on floor
      if (isChaos) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(width * 0.16, height - 34, 46, 22);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(width * 0.16, height - 34, 46, 22);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('140W BRICK', width * 0.16 + 4, height - 20);
      }

      // 5. RENDER CABLES (Underneath the shelf in Stealth, Over desk in Chaos)
      cableState.cables.forEach(cable => {
        if (!cableState.devices[cable.device]) return;
        const pts = cable.points;
        if (pts.length < 2) return;

        // Shadow pass (crisp offset without multi-pass Gaussian blur)
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y + 4);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2 + 4;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y + 4, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y + 4);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = cable.width + 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Core Cable Jacket
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = cable.color;
        ctx.lineWidth = cable.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Braided Weave Texture
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = cable.weaveColor;
        ctx.lineWidth = cable.width * 0.45;
        ctx.stroke();
        ctx.restore();

        // Specular Crest Light
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y - cable.width * 0.15);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2 - cable.width * 0.15;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y - cable.width * 0.15, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y - cable.width * 0.15);
        ctx.strokeStyle = cable.sheenColor;
        ctx.lineWidth = cable.width * 0.25;
        ctx.stroke();

        // X-Ray Animated Energy & Data Photon Pulses
        if (cableState.xrayProgress > 0.05) {
          ctx.save();
          ctx.globalAlpha = cableState.xrayProgress;
          const pulseSpeed = cable.id === 'tb4' ? 0.08 : 0.05;
          const pPhase = (cableState.simTick * pulseSpeed) % 1;

          for (let k = 0; k < 3; k++) {
            const frac = (pPhase + k * 0.33) % 1;
            const ptIdx = frac * (pts.length - 1);
            const p0 = pts[Math.floor(ptIdx)];
            const p1 = pts[Math.min(Math.floor(ptIdx) + 1, pts.length - 1)];
            const sub = ptIdx - Math.floor(ptIdx);
            const px = p0.x + (p1.x - p0.x) * sub;
            const py = p0.y + (p1.y - p0.y) * sub;

            const glow = ctx.createRadialGradient(px, py, 1, px, py, 10);
            glow.addColorStop(0, cable.photonColor);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        // Metal Connectors at endpoints
        const drawPlug = (pt) => {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(pt.x - 6, pt.y - 6, 12, 12, 2) : ctx.rect(pt.x - 6, pt.y - 6, 12, 12);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Glowing LED
          ctx.fillStyle = cable.ledColor;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
        };
        drawPlug(pts[0]);
        drawPlug(pts[pts.length - 1]);
      });

      // 6. Mechanical Keyboard & Mouse (Slides dynamically!)
      const kbW = 150 * uiScale;
      const kbH = 48 * uiScale;
      const kbTuckedY = shelfY + 12;
      const kbOutY = tableY + 95 * uiScale;
      const kbY = kbOutY + (kbTuckedY - kbOutY) * cableState.keyboardProgress;
      const kbX = width * 0.44;

      // Keyboard shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kbX - kbW / 2, kbY + 3, kbW, kbH, 6) : ctx.rect(kbX - kbW / 2, kbY + 3, kbW, kbH);
      ctx.fill();

      // Keyboard base
      ctx.fillStyle = '#111620';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kbX - kbW / 2, kbY, kbW, kbH, 5) : ctx.rect(kbX - kbW / 2, kbY, kbW, kbH);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Keycap rows
      ctx.fillStyle = '#1e293b';
      const kCols = isMobile ? 8 : 12;
      const kRows = 3;
      for (let r = 0; r < kRows; r++) {
        for (let c = 0; c < kCols; c++) {
          const kx = kbX - kbW / 2 + 6 * uiScale + c * (kbW / (kCols + 0.5));
          const ky = kbY + 5 * uiScale + r * (kbH / (kRows + 0.8));
          ctx.fillRect(kx, ky, 8 * uiScale, 7 * uiScale);
        }
      }

      // Mouse on the right
      const mouseX = isMobile ? kbX + kbW / 2 + 18 : kbX + kbW / 2 + 45;
      const mouseY = kbY + 4;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(mouseX - 10 * uiScale, mouseY, 20 * uiScale, 32 * uiScale, 8) : ctx.rect(mouseX - 10 * uiScale, mouseY, 20 * uiScale, 32 * uiScale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();

      // 7. THE GEEKNOOK FOCUS STATION SHELF (Solid Oak / X-Ray Blueprint)
      const shelfThickness = 18;
      const legW = 24;
      const legH = 34;
      const leftLegX = shelfX + 24;
      const rightLegX = shelfX + shelfW - 24 - legW;

      // Aluminum D16T Legs
      const drawLeg = (lx) => {
        const legGrad = ctx.createLinearGradient(lx, shelfY + shelfThickness, lx + legW, shelfY + shelfThickness);
        legGrad.addColorStop(0, '#334155');
        legGrad.addColorStop(0.5, '#64748b');
        legGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = legGrad;
        ctx.fillRect(lx, shelfY + shelfThickness, legW, legH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(lx, shelfY + shelfThickness, legW, legH);

        // Hex bolt
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(lx + legW / 2, shelfY + shelfThickness + legH / 2, 3, 0, Math.PI * 2); ctx.fill();

        // Natural Cork foot pad
        ctx.fillStyle = '#b45309';
        ctx.fillRect(lx, shelfY + shelfThickness + legH - 4, legW, 4);
      };
      drawLeg(leftLegX);
      drawLeg(rightLegX);

      // Under-Shelf T-Track Aluminum Guide Rail (Revealed in X-Ray and partially in Stealth)
      const railH = 14;
      const railY = shelfY + shelfThickness;
      const railX = shelfX + 50;
      const railW = shelfW - 100;

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(railX, railY, railW, railH, 3) : ctx.rect(railX, railY, railW, railH);
      ctx.fill();
      ctx.strokeStyle = cableState.xrayProgress > 0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4 Neodymium N52 magnetic brackets on the T-Track
      const slotRels = [0.22, 0.44, 0.62, 0.78];
      const slotLabels = ['N52-A', 'N52-B', 'N52-C', 'N52-D'];
      slotRels.forEach((rel, sIdx) => {
        const sx = shelfX + shelfW * rel;
        ctx.fillStyle = cableState.mode === 'chaos' ? '#334155' : '#0284c7';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(sx - 12, railY + 1, 24, railH - 2, 2) : ctx.rect(sx - 12, railY + 1, 24, railH - 2);
        ctx.fill();

        if (cableState.mode !== 'chaos') {
          // Magnet cyan pulse
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath(); ctx.arc(sx, railY + railH / 2, 2, 0, Math.PI * 2); ctx.fill();
        }

        if (cableState.xrayProgress > 0.3) {
          ctx.save();
          ctx.globalAlpha = cableState.xrayProgress;
          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(slotLabels[sIdx].toUpperCase(), sx, railY - 4);
          ctx.restore();
        }
      });

      // The Solid Oak Wood Shelf Plank
      // Drop shadow of shelf on desk (zero blur overhead)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(shelfX, shelfY + 8, shelfW, shelfThickness + 4, 6) : ctx.rect(shelfX, shelfY + 8, shelfW, shelfThickness + 4);
      ctx.fill();

      if (cableState.xrayProgress > 0.02) {
        // X-Ray Mode: Translucent glass blueprint with glowing edge
        ctx.fillStyle = `rgba(15, 23, 42, ${1 - cableState.xrayProgress * 0.75})`;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + cableState.xrayProgress * 0.6})`;
        ctx.lineWidth = 1.5;
      } else {
        // Normal Solid Oak plank
        const oakGrad = ctx.createLinearGradient(shelfX, shelfY, shelfX, shelfY + shelfThickness);
        oakGrad.addColorStop(0, '#e5be82');
        oakGrad.addColorStop(0.3, '#d4a359');
        oakGrad.addColorStop(0.7, '#c69248');
        oakGrad.addColorStop(1, '#a6722e');
        ctx.fillStyle = oakGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(shelfX, shelfY, shelfW, shelfThickness, 4) : ctx.rect(shelfX, shelfY, shelfW, shelfThickness);
      ctx.fill();
      ctx.stroke();

      // Wood Grain Lines on the shelf top (if not fully X-ray)
      if (cableState.xrayProgress < 0.8) {
        ctx.save();
        ctx.globalAlpha = 1 - cableState.xrayProgress;
        ctx.strokeStyle = 'rgba(120, 70, 20, 0.22)';
        ctx.lineWidth = 1;
        for (let gx = shelfX + 20; gx < shelfX + shelfW - 20; gx += 45) {
          ctx.beginPath();
          ctx.moveTo(gx, shelfY + 2);
          ctx.bezierCurveTo(gx + 10, shelfY + 8, gx - 8, shelfY + 12, gx + 5, shelfY + shelfThickness - 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // X-Ray center technical branding
      if (cableState.xrayProgress > 0.2) {
        ctx.save();
        ctx.globalAlpha = cableState.xrayProgress;
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#7dd3fc';
        ctx.textAlign = 'center';
        ctx.fillText('FOCUS STATION // INTERNAL T-TRACK CABLE TRAY & DUAL BUS', width * 0.50, shelfY + 11);
        ctx.restore();
      }

      // 8. THE DEVICES ON THE DESK

      // A. Studio Display 5K (Center, resting on Focus Station)
      if (cableState.devices.monitor) {
        const monW = 200 * uiScale;
        const monH = 125 * uiScale;
        const monX = width * 0.50 - monW / 2;
        const monY = shelfY - monH - 16 * uiScale;

        // Monitor Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(width * 0.50 - 14 * uiScale, shelfY - 16 * uiScale, 28 * uiScale, 16 * uiScale);
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(width * 0.50 - 28 * uiScale, shelfY - 4, 56 * uiScale, 4, 2) : ctx.rect(width * 0.50 - 28 * uiScale, shelfY - 4, 56 * uiScale, 4);
        ctx.fill();

        // Monitor Frame & Screen Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX, monY + 4, monW, monH + 4, 8) : ctx.rect(monX, monY + 4, monW, monH + 4);
        ctx.fill();

        // Monitor Frame & Screen Body
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX, monY, monW, monH, 8) : ctx.rect(monX, monY, monW, monH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Screen Wallpaper
        const screenGrad = ctx.createLinearGradient(monX, monY, monX + monW, monY + monH);
        screenGrad.addColorStop(0, '#1e1b4b');
        screenGrad.addColorStop(0.5, '#4338ca');
        screenGrad.addColorStop(0.85, '#06b6d4');
        screenGrad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = screenGrad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX + 5, monY + 5, monW - 10, monH - 12, 4) : ctx.rect(monX + 5, monY + 5, monW - 10, monH - 12);
        ctx.fill();

        // Screen UI Clock & Status
        ctx.font = `bold ${Math.max(9, Math.round(11 * uiScale))}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('10:42', width * 0.50, monY + 28 * uiScale);

        // ScreenBar Light atop Monitor
        if (cableState.devices.screenbar) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(width * 0.50 - 50 * uiScale, monY - 6 * uiScale, 100 * uiScale, 5 * uiScale, 2) : ctx.rect(width * 0.50 - 50 * uiScale, monY - 6 * uiScale, 100 * uiScale, 5 * uiScale);
          ctx.fill();
          ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // B. MacBook Pro 16" (Left side on desk)
      if (cableState.devices.macbook) {
        const mbW = (isMobile ? 85 : 100) * uiScale;
        const mbH = (isMobile ? 56 : 70) * uiScale;
        const mbX = isMobile ? (shelfX - mbW - 8) : (shelfX - 85);
        const mbY = height * (isMobile ? 0.50 : 0.56);

        // Base Keyboard Deck
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mbX, mbY + 36 * uiScale, mbW, 12 * uiScale, 3) : ctx.rect(mbX, mbY + 36 * uiScale, mbW, 12 * uiScale);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Open Screen Lid
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mbX + 4, mbY, mbW - 8, 36 * uiScale, 4) : ctx.rect(mbX + 4, mbY, mbW - 8, 36 * uiScale);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.stroke();

        // MacBook Screen Wallpaper
        const mbGrad = ctx.createLinearGradient(mbX, mbY, mbX + mbW, mbY + 36 * uiScale);
        mbGrad.addColorStop(0, '#0f766e');
        mbGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = mbGrad;
        ctx.fillRect(mbX + 6, mbY + 3, mbW - 12, 30 * uiScale);

        // MacBook MagSafe/TB4 Port
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(mbX + mbW - 3, mbY + 38 * uiScale, 3, 5 * uiScale);
      }

      // C. iPhone on MagSafe Stand (Right side on desk)
      if (cableState.devices.iphone) {
        const phW = 30 * uiScale;
        const phH = 46 * uiScale;
        const phX = isMobile ? (shelfX + shelfW + 8 + phW / 2) : (shelfX + shelfW + 45);
        const phY = height * (isMobile ? 0.48 : 0.54);

        // Sculpted Stand Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(phX - 3, phY + 32 * uiScale, 6, 22 * uiScale);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - 14 * uiScale, phY + 54 * uiScale, 28 * uiScale, 4, 2) : ctx.rect(phX - 14 * uiScale, phY + 54 * uiScale, 28 * uiScale, 4);
        ctx.fill();

        // iPhone Body shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - phW / 2, phY + 4, phW, phH, 6) : ctx.rect(phX - phW / 2, phY + 4, phW, phH);
        ctx.fill();

        // iPhone Body in StandBy
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - phW / 2, phY, phW, phH, 5) : ctx.rect(phX - phW / 2, phY, phW, phH);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // StandBy screen
        ctx.fillStyle = '#042f2e';
        ctx.fillRect(phX - phW / 2 + 2, phY + 2, phW - 4, phH - 4);
        ctx.fillStyle = '#10b981';
        ctx.font = `bold ${Math.max(7, Math.round(8 * uiScale))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 100%', phX, phY + phH * 0.55);
      }

      // 9. Magnetic Snap Spark Particles
      for (let i = cableState.snapSparks.length - 1; i >= 0; i--) {
        const spark = cableState.snapSparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life -= 0.04;

        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, Math.max(spark.life * 3, 0.5), 0, Math.PI * 2);
        ctx.fill();

        if (spark.life <= 0) {
          cableState.snapSparks.splice(i, 1);
        }
      }

      // 10. Callout Warning / Success Badges
      if (isChaos) {
        // Red warnings in Chaos mode
        const drawWarning = (wx, wy, text) => {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          const bw = isMobile ? 220 : 150;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(wx - bw / 2, wy - 12, bw, 24, 12) : ctx.rect(wx - bw / 2, wy - 12, bw, 24);
          ctx.fill();
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, wx, wy + 4);
          ctx.restore();
        };

        if (isMobile) {
          drawWarning(width * 0.50, height * 0.86, '⚠️ Хаос: кабели свисают со стола');
        } else {
          drawWarning(width * 0.32, height * 0.78, '⚠️ Провод лежит на мышке');
          drawWarning(width * 0.72, height * 0.76, '⚠️ Кабель цепляет чашку');
        }
      } else if (!isXray) {
        // Green Zen Success Badges in Stealth mode
        const drawZen = (zx, zy, text) => {
          ctx.save();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
          const bw = isMobile ? 220 : 160;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(zx - bw / 2, zy - 11, bw, 22, 11) : ctx.rect(zx - bw / 2, zy - 11, bw, 22);
          ctx.fill();
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, zx, zy + 4);
          ctx.restore();
        };

        if (isMobile) {
          drawZen(width * 0.50, height * 0.86, '✓ Дзен: 100% кабелей спрятаны в лоток');
        } else {
          drawZen(width * 0.26, height * 0.78, '✓ Стол 100% свободен');
          drawZen(width * 0.74, height * 0.78, '✓ Все кабели убраны в Т-паз');
        }
      }

      // 11. Interactive Drag HUD & Telemetry Reticle
      if (cableState.draggedPoint && cableState.draggedCable) {
        const dp = cableState.draggedPoint;
        const dc = cableState.draggedCable;
        const tensionN = (Math.hypot(dp.x - dp.oldX, dp.y - dp.oldY) * 0.4).toFixed(1);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dp.x, dp.y, 14, 0, Math.PI * 2); ctx.stroke();

        // Tension readout card
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(dp.x + 18, dp.y - 20, 200, 40, 6) : ctx.rect(dp.x + 18, dp.y - 20, 200, 40);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText(dc.name.toUpperCase(), dp.x + 26, dp.y - 6);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`ТЯГА: ${tensionN} Н // СИЛА N52: 12 Н`, dp.x + 26, dp.y + 10);
      } else if (cableState.hoveredPoint && cableState.hoveredCable) {
        const hp = cableState.hoveredPoint;
        const hc = cableState.hoveredCable;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 10, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(hp.x - 110, hp.y - 42, 220, 36, 6) : ctx.rect(hp.x - 110, hp.y - 42, 220, 36);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(hc.name.toUpperCase(), hp.x, hp.y - 26);

        ctx.font = '8px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(hc.spec, hp.x, hp.y - 12);
      }

      if (!isCableVisible) {
        cableState.animFrame = null;
        return;
      }
      cableState.animFrame = requestAnimationFrame(stepPhysics);
    };

    let isCableVisible = true;
    if ('IntersectionObserver' in window) {
      const cableObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isCableVisible = entry.isIntersecting && entry.intersectionRatio > 0;
          if (isCableVisible) {
            if (!cableState.animFrame) {
              cableState.animFrame = requestAnimationFrame(stepPhysics);
            }
          } else {
            if (cableState.animFrame) {
              cancelAnimationFrame(cableState.animFrame);
              cableState.animFrame = null;
            }
          }
        });
      }, { threshold: [0, 0.05] });
      cableObserver.observe(canvas.parentElement || canvas);
    }

    cableState.animFrame = requestAnimationFrame(stepPhysics);
    updateCableMetrics();
  };

  const setCableMode = (mode) => {
    cableState.mode = mode;
    soundEngine.play(mode === 'magnetic' ? 'snap' : (mode === 'xray' ? 'whoosh' : 'toggle'));

    const chaosBtn = document.getElementById('cableModeChaosBtn');
    const magneticBtn = document.getElementById('cableModeMagneticBtn');
    const xrayBtn = document.getElementById('cableModeXrayBtn');

    if (chaosBtn) chaosBtn.classList.toggle('active', mode === 'chaos');
    if (magneticBtn) magneticBtn.classList.toggle('active', mode === 'magnetic');
    if (xrayBtn) xrayBtn.classList.toggle('active', mode === 'xray');

    const statusPill = document.getElementById('cableStatusPill');
    const statusText = document.getElementById('cableStatusText');

    if (statusPill) {
      statusPill.classList.remove('magnetic', 'xray');
      if (mode === 'magnetic') statusPill.classList.add('magnetic');
      if (mode === 'xray') statusPill.classList.add('xray');
    }

    if (mode === 'magnetic') {
      if (statusText) statusText.textContent = 'T-Track замок: 4 канала зафиксированы';
      showToast('GeekNook Stealth: Все кабели уложены в скрытый желоб');
    } else if (mode === 'xray') {
      if (statusText) statusText.textContent = 'Рентген лотка: Разделение шин 220V и данных';
      showToast('Инженерный Рентген: внутренняя архитектура Т-паза');
    } else {
      if (statusText) statusText.textContent = 'Свободное провисание (Хаос на столе)';
      showToast('Режим без GeekNook: хаос проводов на рабочей поверхности');
    }

    updateCableMetrics();
  };

  const shakeCables = () => {
    soundEngine.play('snap');
    cableState.cables.forEach(c => {
      c.points.forEach(p => {
        if (!p.pinned) {
          p.x += (Math.random() - 0.5) * 80;
          p.y += (Math.random() - 0.5) * 70;
        }
      });
    });
    // Add sparks
    if (cableState.cables.length > 0) {
      const p = cableState.cables[0].points[10];
      if (p) {
        for (let i = 0; i < 10; i++) {
          cableState.snapSparks.push({
            x: p.x + (Math.random() - 0.5) * 60,
            y: p.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: '#38bdf8'
          });
        }
      }
    }
    showToast('⚡ Импульс: проверка упругости оплетки и неодимовых магнитов');
  };

  // --- ERGONOMICS POSTURE CALCULATOR (ISO 9241-5) ---
  const ergoState = {
    heightCm: 178,
    deskCm: 75,
    monitorDiag: 27
  };

  const openErgonomicsCalculator = () => {
    updateErgonomicsCalc();
    modalManager.open('ergonomicsModal');
    soundEngine.play('click');
  };

  const selectErgoMonitor = (diag) => {
    ergoState.monitorDiag = Number(diag) || 27;
    document.querySelectorAll('#ergoMonitorChips .ergo-chip').forEach(chip => {
      if (Number(chip.getAttribute('data-diag')) === ergoState.monitorDiag) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
    updateErgonomicsCalc();
    soundEngine.play('click');
  };

  const updateErgonomicsCalc = () => {
    const heightEl = document.getElementById('ergoUserHeight');
    const deskEl = document.getElementById('ergoDeskHeight');
    const heightDisplay = document.getElementById('ergoUserHeightDisplay');
    const deskDisplay = document.getElementById('ergoDeskHeightDisplay');

    if (heightEl) ergoState.heightCm = Number(heightEl.value) || 178;
    if (deskEl) ergoState.deskCm = Number(deskEl.value) || 75;

    if (heightDisplay) heightDisplay.textContent = `${ergoState.heightCm} см`;
    if (deskDisplay) deskDisplay.textContent = `${ergoState.deskCm} см`;

    // Ergonomic ISO 9241 formula
    const seatedEyeLevelFromFloor = Math.round((ergoState.heightCm * 0.43) + 42);
    const monitorBaseHeights = { 24: 36, 27: 41, 32: 45, 34: 43 };
    const monitorHeightFromDesk = monitorBaseHeights[ergoState.monitorDiag] || 41;
    const currentTopBezelFromFloor = ergoState.deskCm + monitorHeightFromDesk;

    const deltaCm = seatedEyeLevelFromFloor - currentTopBezelFromFloor;
    const recommendedLift = Math.max(7, Math.min(12, Math.round(deltaCm > 0 ? deltaCm : 9)));

    const rawNeckTiltDeg = Math.round(Math.max(12, (ergoState.heightCm - 160) * 0.5 + (75 - ergoState.deskCm) * 0.4));
    const spineLoadKg = Math.round(rawNeckTiltDeg * 0.65 + 4);

    const eyeValEl = document.getElementById('ergoEyeLevelVal');
    const liftValEl = document.getElementById('ergoLiftDeltaVal');
    const neckValEl = document.getElementById('ergoNeckAngleVal');
    const textEl = document.getElementById('ergoRecommendationText');

    if (eyeValEl) eyeValEl.textContent = `${seatedEyeLevelFromFloor} см`;
    if (liftValEl) liftValEl.textContent = `+${recommendedLift}.0 см`;
    if (neckValEl) neckValEl.textContent = `0–3° (Норма)`;

    if (textEl) {
      textEl.innerHTML = `Без подставки при вашем росте (${ergoState.heightCm} см) угол наклона головы составляет <strong>${rawNeckTiltDeg}°</strong>, создавая статическое давление до <strong>${spineLoadKg} кг</strong> на шейные позвонки C1–C7. Подставка Focus Station высотой 9 см выравнивает линию взгляда строго по ISO 9241, разгружая плечевой пояс.`;
    }
  };

  const applyErgonomicsRecommendation = () => {
    closeModal('ergonomicsModal');
    openConfigurator();
    soundEngine.play('click');
    showToast('Параметры эргономики применены к конфигуратору!');
  };

  // --- 3D CAD LIBRARY & B2B ASSET DOWNLOAD ---
  const openCadModal = () => {
    modalManager.open('cadLibraryModal');
    soundEngine.play('click');
  };

  const downloadCadAsset = (filename) => {
    soundEngine.play('click');
    const dummyBlob = new Blob([
      `GEEKNOOK ENGINEERING ASSET: ${filename}\nDate: ${new Date().toISOString()}\nCAD Standard: ISO-9241 / STEP AP214 / PBR glTF\nManufacturer: GEEK NOOK (Moscow, Russia)\nWebsite: https://geeknook.ru`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(dummyBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Файл «${filename}» загружен!`, 'success');
  };

  const handleB2bSubmit = (e) => {
    e.preventDefault();
    soundEngine.play('cart');
    const company = document.getElementById('b2bCompany')?.value || 'Компания';
    closeModal('cadLibraryModal');
    showToast(`Запрос для «${escapeHTML(company)}» принят! КП отправлено на email.`, 'success');
  };

  // --- COMMAND PALETTE (Cmd+K / Ctrl+K) ---
  let cmdPaletteActiveIdx = 0;
  let cmdFilteredItems = [];

  const getCommandItems = () => {
    const items = [
      {
        id: 'action-theme-toggle',
        category: 'Настройки',
        title: 'Сменить тему: Тёмная / Светлая',
        sub: `Сейчас: ${themeManager.currentTheme === 'dark' ? 'Тёмная тема' : 'Светлая тема'} (горячая клавиша: T)`,
        badge: 'Тема (T)',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path></svg>',
        action: () => { closeCommandPalette(); themeManager.toggleTheme(true); }
      },
      {
        id: 'action-sound-toggle',
        category: 'Настройки',
        title: 'Тактильный звук (Micro-Haptics)',
        sub: `Сейчас: ${soundEngine.enabled ? 'Включен' : 'Выключен'} (горячая клавиша: S)`,
        badge: 'Звук (S)',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>',
        action: () => { closeCommandPalette(); toggleSound(); }
      },
      {
        id: 'action-bundles',
        category: 'Инструменты',
        title: 'Готовые инженерные комплекты (-15%)',
        sub: 'Developer Pro, Creator Studio, Minimalist Focus',
        badge: 'Скидки',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><line x1="1" y1="3" x2="23" y2="3"></line><path d="M10 12h4"></path></svg>',
        action: () => {
          closeCommandPalette();
          const el = document.getElementById('bundles');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      },
      {
        id: 'action-transformation',
        category: 'Инструменты',
        title: 'Сравнение До / После (Трансформация)',
        sub: 'Интерактивный слайдер организации рабочего места',
        badge: 'Сравнение',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>',
        action: () => {
          closeCommandPalette();
          const el = document.getElementById('transformation');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      },
      {
        id: 'action-ergo',
        category: 'Инструменты',
        title: 'Калькулятор эргономики осанки (ISO 9241)',
        sub: 'Расчет высоты монитора и разгрузка шеи под ваш рост',
        badge: 'ISO-9241',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
        action: () => { closeCommandPalette(); openErgonomicsCalculator(); }
      },
      {
        id: 'action-cad',
        category: 'Инструменты',
        title: '3D CAD-библиотека (.STEP / .GLB)',
        sub: 'Файлы для архитекторов и оптовое КП для офисов',
        badge: 'B2B CAD',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-9.9-9.9c-.4-.4-.4-1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l9.9 9.9c.4.4.4 1 0 1.4z"></path></svg>',
        action: () => { closeCommandPalette(); openCadModal(); }
      },
      {
        id: 'action-blueprint',
        category: 'Инструменты',
        title: 'Взрыв-схема Focus Station (Blueprint)',
        sub: 'Интерактивные узлы: Д16Т, каленые винты 8.8, пробка 2 мм',
        badge: 'Чертеж',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18h8"></path><path d="M3 22h18"></path><path d="M14 22a7 7 0 1 0-14 0"></path></svg>',
        action: () => {
          closeCommandPalette();
          const el = document.getElementById('production');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          switchProductionTab('blueprint');
        }
      },
      {
        id: 'action-fea-lab',
        category: 'Инструменты',
        title: 'FEA Лаборатория сопромата & Краш-тест',
        sub: 'Интерактивная тепловая карта деформации и тест прочности 5–85 кг',
        badge: 'Сопромат',
        icon: '⚙️',
        action: () => {
          closeCommandPalette();
          const el = document.getElementById('production');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
          switchProductionTab('stress');
        }
      },
      {
        id: 'action-cable-physics',
        category: 'Инструменты',
        title: 'Симулятор кабель-менеджмента 360° (Verlet)',
        sub: 'Интерактивная физика кабелей и магнитная укладка T-Track',
        badge: 'Физика',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4a2 2 0 0 0-4 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"></path></svg>',
        action: () => {
          closeCommandPalette();
          const el = document.getElementById('cableSimulatorCard');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      },
      {
        id: 'action-3d-studio',
        category: 'Инструменты',
        title: '3D Студия Focus Station (WebGL Three.js)',
        sub: 'Орбитальная 3D-модель, монтаж в Т-паз и 3D взрыв-схема',
        badge: 'WebGL 3D',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>',
        action: () => {
          closeCommandPalette();
          openConfigurator();
          setConfigViewMode('3d');
        }
      },
      {
        id: 'action-config',
        category: 'Инструменты',
        title: '3D-Конструктор Focus Station',
        sub: 'Собрать индивидуальный сетап подставки',
        badge: 'Инструмент',
        icon: '⚙️',
        action: () => { closeCommandPalette(); openConfigurator(); }
      },
      {
        id: 'action-matcher',
        category: 'Инструменты',
        title: 'Примерщик мониторов (Setup Matcher)',
        sub: 'Проверить размер подставки под 24", 27", 34" Ultrawide',
        badge: 'Калькулятор',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 15.3l-6.6 6.6c-.4.4-1 .4-1.4 0l-9.9-9.9c-.4-.4-.4-1 0-1.4l6.6-6.6c.4-.4 1-.4 1.4 0l9.9 9.9c.4.4.4 1 0 1.4z"></path></svg>',
        action: () => { closeCommandPalette(); openSetupMatcher(); }
      },
      {
        id: 'action-quiz',
        category: 'Инструменты',
        title: 'Квиз подбора сетапа',
        sub: 'Ответьте на 3 вопроса для идеальной станции',
        badge: 'Квиз',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
        action: () => { closeCommandPalette(); openQuiz(); }
      },
      {
        id: 'action-cart',
        category: 'Действия',
        title: 'Открыть корзину',
        sub: `В корзине: ${state.cart.reduce((s, i) => s + (parseInt(i.quantity, 10) || 1), 0)} шт.`,
        badge: 'Корзина',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
        action: () => { closeCommandPalette(); openCartDrawer(); }
      },
      {
        id: 'action-clear-cart',
        category: 'Действия',
        title: 'Очистить всю корзину',
        sub: 'Удалить все добавленные товары',
        badge: 'Корзина',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        action: () => { closeCommandPalette(); clearCart(); }
      },
      {
        id: 'action-telegram',
        category: 'Действия',
        title: 'Связаться с инженером в Telegram',
        sub: 'Быстрая консультация по сетапу и размерам',
        badge: 'Чат',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
        action: () => { closeCommandPalette(); window.open('https://t.me/geeknook', '_blank'); }
      },
      {
        id: 'action-legal',
        category: 'Информация',
        title: 'Доставка и гарантия 2 года',
        sub: 'СДЭК по всей России, возврат 14 дней',
        badge: 'Сервис',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
        action: () => { closeCommandPalette(); openLegalModal('delivery'); }
      }
    ];

    (GEEKNOOK_DATA.bundles || []).forEach(b => {
      items.push({
        id: `bundle-${b.id}`,
        category: 'Готовые комплекты',
        title: b.title,
        sub: `${formatPrice(b.price)} • ${b.badge} • ${b.savings}`,
        badge: `${formatPrice(b.price)}`,
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><line x1="1" y1="3" x2="23" y2="3"></line><path d="M10 12h4"></path></svg>',
        action: () => { closeCommandPalette(); addBundleToCart(b.id); }
      });
    });

    (GEEKNOOK_DATA.allProducts || []).forEach(p => {
      items.push({
        id: `product-${p.id}`,
        category: p.category === 'boards' ? 'Доски Focus Station' : (p.category === 'accessories' ? 'Модули T-Track' : 'Коврики'),
        title: p.title,
        sub: `${formatPrice(p.price)} • ${p.materials ? p.materials.split(',')[0] : 'Массив дерева'}`,
        badge: `${formatPrice(p.price)}`,
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 16 21 21 3 21 3 16"></polyline><line x1="12" y1="1" x2="12" y2="16"></line><line x1="8" y1="12" x2="12" y2="16"></line><line x1="16" y1="12" x2="12" y2="16"></line></svg>',
        action: () => { closeCommandPalette(); openQuickView(p.id); }
      });
    });

    return items;
  };

  const openCommandPalette = () => {
    modalManager.open('commandPaletteModal');
    const input = document.getElementById('cmdPaletteInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    cmdPaletteActiveIdx = 0;
    renderCommandResults('');
  };

  const closeCommandPalette = () => {
    modalManager.close('commandPaletteModal');
  };

  const renderCommandResults = (query = '') => {
    const container = document.getElementById('cmdPaletteResults');
    if (!container) return;

    const allItems = getCommandItems();
    const cleanQ = query.trim().toLowerCase();

    cmdFilteredItems = cleanQ
      ? allItems.filter(item =>
          item.title.toLowerCase().includes(cleanQ) ||
          item.sub.toLowerCase().includes(cleanQ) ||
          item.category.toLowerCase().includes(cleanQ)
        )
      : allItems;

    if (cmdFilteredItems.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 0.9375rem;">
          Ничего не найдено по запросу «${escapeHTML(cleanQ)}»
        </div>
      `;
      return;
    }

    if (cmdPaletteActiveIdx >= cmdFilteredItems.length) {
      cmdPaletteActiveIdx = 0;
    }

    const groups = {};
    cmdFilteredItems.forEach((item, idx) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push({ item, globalIdx: idx });
    });

    let html = '';
    Object.entries(groups).forEach(([cat, list]) => {
      html += `<div class="cmd-group-title">${escapeHTML(cat)}</div>`;
      list.forEach(({ item, globalIdx }) => {
        const isActive = globalIdx === cmdPaletteActiveIdx;
        html += `
          <div class="cmd-item ${isActive ? 'active' : ''}" onclick="window.geekNookApp.executeCommand(${globalIdx})">
            <div class="cmd-item-left">
              <span class="cmd-item-icon">${item.icon}</span>
              <div>
                <span class="cmd-item-title">${escapeHTML(item.title)}</span>
                <span class="cmd-item-sub">${escapeHTML(item.sub)}</span>
              </div>
            </div>
            <span class="cmd-item-badge">${escapeHTML(item.badge)}</span>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  };

  const executeCommand = (idx) => {
    if (cmdFilteredItems[idx] && typeof cmdFilteredItems[idx].action === 'function') {
      cmdFilteredItems[idx].action();
    }
  };

  const initCommandPalette = () => {
    const input = document.getElementById('cmdPaletteInput');
    if (input) {
      input.addEventListener('input', (e) => {
        cmdPaletteActiveIdx = 0;
        renderCommandResults(e.target.value);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (cmdFilteredItems.length > 0) {
            cmdPaletteActiveIdx = (cmdPaletteActiveIdx + 1) % cmdFilteredItems.length;
            renderCommandResults(input.value);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (cmdFilteredItems.length > 0) {
            cmdPaletteActiveIdx = (cmdPaletteActiveIdx - 1 + cmdFilteredItems.length) % cmdFilteredItems.length;
            renderCommandResults(input.value);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeCommand(cmdPaletteActiveIdx);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        }
      });
    }

    // Global shortcut Cmd+K / Ctrl+K
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const modal = document.getElementById('commandPaletteModal');
        if (modal && modal.classList.contains('active')) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      }
    });
  };

  // --- SETUP MATCHER (Инженерный примерщик мониторов) ---
  const matcherState = {
    deskWidth: 140,
    monitorSetup: 'single-27'
  };

  const MONITOR_SETUPS = {
    'single-24': { label: '1x 24"', widthMm: 540, count: 1, desc: 'Компактный монитор' },
    'single-27': { label: '1x 27"', widthMm: 610, count: 1, desc: 'Золотой стандарт' },
    'single-34': { label: '1x 34" UW', widthMm: 810, count: 1, desc: 'Ultrawide' },
    'dual-24': { label: '2x 24" Dual', widthMm: 1080, count: 2, desc: 'Два монитора 24"' },
    'dual-27': { label: '2x 27" Dual', widthMm: 1220, count: 2, desc: 'Два монитора 27"' },
    'mac-27': { label: 'MacBook + 27"', widthMm: 930, count: 2, desc: 'Ноутбук + 27" дисплей' }
  };

  const initSetupMatcher = () => {
    try {
      const saved = safeStorage.getItem('geeknook_matcher_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.deskWidth) matcherState.deskWidth = parsed.deskWidth;
          if (parsed.monitorSetup && MONITOR_SETUPS[parsed.monitorSetup]) matcherState.monitorSetup = parsed.monitorSetup;
          document.querySelectorAll('#deskWidthChips .matcher-chip').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.width, 10) === matcherState.deskWidth);
          });
          document.querySelectorAll('#monitorSetupChips .matcher-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.setup === matcherState.monitorSetup);
          });
        }
      }
    } catch (e) {}

    const svgWrap = document.getElementById('matcherSvgWrap');
    if (svgWrap) {
      renderMatcherVisualizer();
    }
  };

  const openSetupMatcher = () => {
    modalManager.open('setupMatcherModal');
    renderMatcherVisualizer();
  };

  const selectMatcherDeskWidth = (widthCm) => {
    matcherState.deskWidth = parseInt(widthCm, 10) || 140;
    document.querySelectorAll('#deskWidthChips .matcher-chip').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.width, 10) === matcherState.deskWidth);
    });
    safeStorage.setItem('geeknook_matcher_state', JSON.stringify({ deskWidth: matcherState.deskWidth, monitorSetup: matcherState.monitorSetup }));
    renderMatcherVisualizer();
  };

  const selectMatcherMonitor = (setupKey) => {
    if (!MONITOR_SETUPS[setupKey]) return;
    matcherState.monitorSetup = setupKey;
    document.querySelectorAll('#monitorSetupChips .matcher-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.setup === setupKey);
    });
    safeStorage.setItem('geeknook_matcher_state', JSON.stringify({ deskWidth: matcherState.deskWidth, monitorSetup: matcherState.monitorSetup }));
    renderMatcherVisualizer();
  };

  const renderMatcherVisualizer = () => {
    const svgWrap = document.getElementById('matcherSvgWrap');
    const specsRow = document.getElementById('matcherSpecsRow');
    const recEl = document.getElementById('matcherRecommendation');
    if (!svgWrap || !specsRow) return;

    const deskWidthMm = matcherState.deskWidth * 10;
    const mon = MONITOR_SETUPS[matcherState.monitorSetup];
    const monWidthMm = mon.widthMm;

    const recommendedShelfMm = monWidthMm >= 800 ? 1160 : 850;
    const recommendedShelfName = recommendedShelfMm === 1160 ? 'Focus Station 116 (116 см)' : 'Focus Station 85 (85 см)';
    const remainingSideCm = Math.max(0, Math.round(((deskWidthMm - Math.max(recommendedShelfMm, monWidthMm)) / 2) / 10));

    const svgW = 860;
    const svgH = 200;
    const padX = 40;
    const availableW = svgW - padX * 2;
    const scale = availableW / deskWidthMm;

    const deskPx = deskWidthMm * scale;
    const deskX = padX;
    const deskY = 158;
    const deskH = 22;

    const shelfPx = recommendedShelfMm * scale;
    const shelfX = deskX + (deskPx - shelfPx) / 2;
    const shelfY = 120;
    const shelfH = 14;
    const legsH = 24;

    const monPx = monWidthMm * scale;
    const monX = deskX + (deskPx - monPx) / 2;
    const monY = 28;
    const monH = 80;

    let monitorsSvg = '';
    if (mon.count === 1) {
      monitorsSvg = `
        <rect x="${monX + monPx / 2 - 10}" y="${monY + monH}" width="20" height="${shelfY - (monY + monH)}" fill="#334155" rx="2"/>
        <rect x="${monX + monPx / 2 - 35}" y="${shelfY - 4}" width="70" height="6" fill="#1e293b" rx="2"/>
        <rect x="${monX}" y="${monY}" width="${monPx}" height="${monH}" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <rect x="${monX + 4}" y="${monY + 4}" width="${monPx - 8}" height="${monH - 8}" rx="4" fill="#1e293b" opacity="0.8"/>
        <text x="${monX + monPx / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">${mon.label}</text>
      `;
    } else if (matcherState.monitorSetup === 'mac-27') {
      const macW = 280 * scale;
      const screen27W = 610 * scale;
      const gap = 12 * scale;
      const totalW = macW + gap + screen27W;
      const startX = deskX + (deskPx - totalW) / 2;

      monitorsSvg = `
        <rect x="${startX}" y="${monY + 24}" width="${macW}" height="${monH - 24}" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
        <text x="${startX + macW / 2}" y="${monY + 60}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">MacBook</text>
        <rect x="${startX + macW + gap + screen27W / 2 - 10}" y="${monY + monH}" width="20" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${startX + macW + gap}" y="${monY}" width="${screen27W}" height="${monH}" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${startX + macW + gap + screen27W / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">27" Display</text>
      `;
    } else {
      const singleW = (monPx - 10 * scale) / 2;
      const m1X = monX;
      const m2X = monX + singleW + 10 * scale;
      monitorsSvg = `
        <rect x="${m1X + singleW / 2 - 8}" y="${monY + monH}" width="16" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${m1X}" y="${monY}" width="${singleW}" height="${monH}" rx="5" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${m1X + singleW / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${mon.label.split(' ')[0]}</text>
        <rect x="${m2X + singleW / 2 - 8}" y="${monY + monH}" width="16" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${m2X}" y="${monY}" width="${singleW}" height="${monH}" rx="5" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${m2X + singleW / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${mon.label.split(' ')[0]}</text>
      `;
    }

    svgWrap.innerHTML = `
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="190" preserveAspectRatio="xMidYMid meet">
        <!-- Desk Top Plate -->
        <rect x="${deskX}" y="${deskY}" width="${deskPx}" height="${deskH}" rx="4" fill="#1e2532" stroke="#334155" stroke-width="1.5"/>
        <text x="${deskX + 16}" y="${deskY + 15}" fill="#64748b" font-family="monospace" font-size="10" font-weight="bold">СТОЛ ${matcherState.deskWidth} СМ</text>

        <!-- Monitors -->
        ${monitorsSvg}

        <!-- GeekNook Focus Station Shelf -->
        <rect x="${shelfX + 22}" y="${shelfY + shelfH}" width="14" height="${legsH}" rx="2" fill="#0f172a" stroke="#475569" stroke-width="1.2"/>
        <rect x="${shelfX + shelfPx - 36}" y="${shelfY + shelfH}" width="14" height="${legsH}" rx="2" fill="#0f172a" stroke="#475569" stroke-width="1.2"/>
        <rect x="${shelfX}" y="${shelfY}" width="${shelfPx}" height="${shelfH}" rx="3" fill="#2563eb" stroke="#60a5fa" stroke-width="1.5"/>
        <text x="${shelfX + shelfPx / 2}" y="${shelfY + 11}" fill="#ffffff" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">GEEKNOOK ${recommendedShelfMm} ММ</text>

        <!-- Dimension Arrow lines -->
        <line x1="${shelfX}" y1="${shelfY - 6}" x2="${shelfX + shelfPx}" y2="${shelfY - 6}" stroke="#60a5fa" stroke-width="1.2" stroke-dasharray="3 3"/>
        <text x="${shelfX + shelfPx / 2}" y="${shelfY - 10}" fill="#60a5fa" font-family="monospace" font-size="10" text-anchor="middle">↔ ${recommendedShelfMm} мм</text>

        <line x1="${deskX}" y1="${deskY + deskH + 10}" x2="${deskX + deskPx}" y2="${deskY + deskH + 10}" stroke="#94a3b8" stroke-width="1.2"/>
        <text x="${deskX + deskPx / 2}" y="${deskY + deskH + 22}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">Ширина столешницы: ${matcherState.deskWidth} см</text>
      </svg>
    `;

    specsRow.innerHTML = `
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Ширина столешницы</div>
        <div class="matcher-spec-val">${matcherState.deskWidth} см</div>
      </div>
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Размах мониторов</div>
        <div class="matcher-spec-val">${Math.round(monWidthMm / 10)} см</div>
      </div>
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Свободно по бокам</div>
        <div class="matcher-spec-val highlight">${remainingSideCm} см с каждой стороны</div>
      </div>
    `;

    if (recEl) {
      recEl.innerHTML = `Рекомендуемая модель: <strong>${recommendedShelfName}</strong> — идеальный баланс рабочей зоны.`;
    }
  };

  const applyMatcherToConfigurator = () => {
    const mon = MONITOR_SETUPS[matcherState.monitorSetup];
    const targetLen = (mon && mon.widthMm >= 800) ? '116' : '85';
    closeModal('setupMatcherModal');
    openConfigurator();
    selectConfigLength(targetLen);
    showToast(`Выбрана длина подставки ${targetLen} см под ваш сетап!`, 'success');
  };

  // --- TELEPHONE NUMBER AUTO-FORMATTING MASK ---
  const initPhoneMasks = () => {
    const attachMask = (el) => {
      if (!el || el.dataset.maskAttached) return;
      el.dataset.maskAttached = 'true';
      el.addEventListener('input', () => {
        let val = el.value.replace(/\D/g, '');
        if (!val) {
          el.value = '';
          return;
        }
        if (val.startsWith('7') || val.startsWith('8')) {
          val = val.substring(1);
        }
        val = val.substring(0, 10);
        let formatted = '+7';
        if (val.length > 0) formatted += ' (' + val.substring(0, 3);
        if (val.length >= 3) formatted += ') ' + val.substring(3, 6);
        if (val.length >= 6) formatted += '-' + val.substring(6, 8);
        if (val.length >= 8) formatted += '-' + val.substring(8, 10);
        el.value = formatted;
      });
    };

    attachMask(document.getElementById('checkoutPhone'));
    attachMask(document.getElementById('quickBuyPhone'));
  };

  // --- INITIALIZE APPLICATION ---
  const init = () => {
    // 1. Global image fallback (Capture phase handles non-bubbling img error events)
    window.addEventListener('error', (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        if (!img.dataset.hasFallback) {
          img.dataset.hasFallback = 'true';
          img.src = toAssetUrl('images/tild3763-3337-4662-b233-616531316364__3.jpg');
        }
      }
    }, true);

    // 2. Global Unhandled Promise Rejection Boundary
    window.addEventListener('unhandledrejection', (event) => {
      console.warn('[Defensive] Handled unhandled Promise rejection:', event.reason);
    });

    // 3. Developer Console Easter Egg
    console.log(
      `%c  ____ _____ _____ _  ___   _  ___   ___  _  __\n / ___| ____| ____| |/ / \\ | |/ _ \\ / _ \\| |/ /\n| |  _|  _| |  _| | ' /|  \\| | | | | | | | ' / \n| |_| | |___| |___| . \\| |\\  | |_| | |_| | . \\ \n \\____|_____|_____|_|\\_\\_| \\_|\\___/ \\___/|_|\\_\\ \n\n%cCrafted with pure Vanilla ES6+ & 60 FPS Canvas. Zero bloatware.\nSecret developer promo code: %cDEVTOOLS10%c (10% off in cart)`,
      'color: #2b70f0; font-weight: bold; font-family: monospace;',
      'color: #94a3b8; font-size: 11px; font-family: monospace;',
      'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px; font-family: monospace;',
      'color: #94a3b8; font-family: monospace;'
    );

    themeManager.init();
    initHeroVideo();
    initAntigravitySphere();
    initCommandPalette();
    initSetupMatcher();
    initPhoneMasks();

    initHeaderScroll();
    renderBoards();
    renderAccessories();
    renderMats();
    renderBundles();
    initBeforeAfterSlider();
    initCardTiltInteraction();
    renderAdvantages();
    renderProduction();
    renderClientSetups();
    renderGallery();
    renderAbout();
    renderJournal();
    renderFAQ();
    updateCartUI();
    initScrollReveals();
    initCableSimulator();
    initFeaLab();
    initProduction3DStudio();
    parseUrlConfig();

    // 4. Global ESC key listener to close all active modals & drawers seamlessly
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalManager.closeAll();
      }
    });

    // 5. Close support widget dropdown on outside click
    document.addEventListener('click', (e) => {
      const widget = document.getElementById('supportWidget');
      const dropdown = document.getElementById('supportWidgetDropdown');
      if (widget && dropdown && dropdown.style.display === 'block') {
        if (!widget.contains(e.target)) {
          toggleSupportWidget();
        }
      }
    });
  };

  const toggleSupportWidget = () => {
    const dropdown = document.getElementById('supportWidgetDropdown');
    const trigger = document.getElementById('supportTriggerBtn');
    if (!dropdown || !trigger) return;
    
    const isHidden = dropdown.style.display === 'none' || !dropdown.style.display;
    dropdown.style.display = isHidden ? 'block' : 'none';
    
    const chatIcon = trigger.querySelector('.support-icon-chat');
    const closeIcon = trigger.querySelector('.support-icon-close');
    const ping = trigger.querySelector('.support-btn-ping');
    
    if (chatIcon && closeIcon) {
      chatIcon.style.display = isHidden ? 'none' : 'block';
      closeIcon.style.display = isHidden ? 'block' : 'none';
    }
    if (ping) {
      ping.style.display = isHidden ? 'none' : 'block';
    }
    if (soundEngine && typeof soundEngine.play === 'function') {
      soundEngine.play('click');
    }
  };

  // Public API
  window.geekNookApp = {
    init,
    toggleSupportWidget,
    addToCart,
    quickAddWithFeedback,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    openCartDrawer,
    closeCartDrawer,
    openMobileNav,
    closeMobileNav,
    applyPromoCode,
    openQuickView,
    switchQvImage,
    addFromQuickView,
    openConfigurator,
    selectConfigFinish,
    selectConfigLength,
    toggleConfigAddon,
    toggleConfigEngraving,
    updateConfigEngravingText,
    addConfiguredBundleToCart,
    openCheckout,
    handleCheckoutSubmit,
    openLightbox,
    openArticle,
    closeModal,
    renderFAQ,
    toggleFAQ,
    openQuickBuy,
    handleQuickBuySubmit,
    quickBuyViaTelegram,
    orderViaTelegram,
    orderConfigViaTelegram,
    shareConfiguredSetup,
    openQuiz,
    renderQuizStep,
    selectQuizOption,
    prevQuizStep,
    addQuizBundleToCart,
    openLegalModal,
    switchLegalTab,
    openCommandPalette,
    closeCommandPalette,
    executeCommand,
    openSetupMatcher,
    selectMatcherDeskWidth,
    selectMatcherMonitor,
    applyMatcherToConfigurator,
    toggleTheme,
    setTheme,
    getTheme,
    toggleSound,
    soundEngine,
    renderBundles,
    addBundleToCart,
    initBeforeAfterSlider,
    setTransformationSlider,
    scrollToProductionBlock,
    switchProductionTab,
    toggleHotspot,
    openErgonomicsCalculator,
    selectErgoMonitor,
    updateErgonomicsCalc,
    applyErgonomicsRecommendation,
    openCadModal,
    downloadCadAsset,
    handleB2bSubmit,
    // Hardcore Engineering Suite (Features 1-3 & Production 3D)
    calculateFeaPhysics,
    renderFeaCanvas,
    updateFeaWeight,
    setFeaPreset,
    runFeaShockTest,
    initFeaLab,
    initCableSimulator,
    cableState,
    setCableMode,
    shakeCables,
    toggleCableDevice,
    updateCableMetrics,
    setConfigViewMode,
    toggle3dExplode,
    set3dLighting,
    update3dModulePosition,
    focusStation3DStudio,
    production3DStudio,
    initProduction3DStudio,
    setProduction3dFinish,
    setProduction3dLength,
    setProduction3dLighting,
    toggleProduction3dExplode,
    toggleProduction3dAutoRotate,
    toggleProduction3dAddon,
    themeManager,
    modalManager,
    safeStorage,
    escapeHTML
  };

  let isAppInitialized = false;
  const safeInit = () => {
    if (isAppInitialized) return;
    isAppInitialized = true;
    init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }
})();
