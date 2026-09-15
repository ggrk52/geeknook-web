/**
 * GeekNook Module: Core
 * Application state, safe storage, sound synthesizer, theme manager, and UI safety helpers.
 */
window.GeekNook = window.GeekNook || {};

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
        showToast('Тактильный звук включен 🔊');
      } else {
        showToast('Звук выключен 🔇');
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
          showToast('Тёмная тема включена 🌙');
        } else {
          showToast('Светлая тема включена ☀️');
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


window.GeekNook.core = {
  safeStorage,
  escapeHTML,
  modalManager,
  actionLock,
  state,
  formatPrice,
  saveCart,
  showToast,
  soundEngine,
  themeManager
};
