/**
 * GeekNook Interactive CDEK PVZ Picker & Map Module
 * Zero-order-submission safety: Read-only PVZ selection and validation.
 * Supports Leaflet interactive map, fast client-side search, top cities preloading,
 * self-injecting modal and styles for seamless operation across standalone & Tilda environments.
 */
(function(window) {
  'use strict';

  // City center coordinates for instant map centering
  const CITY_COORDINATES = {
    'Москва': [55.7558, 37.6173],
    'Санкт-Петербург': [59.9343, 30.3351],
    'Новосибирск': [55.0084, 82.9357],
    'Екатеринбург': [56.8389, 60.6057],
    'Казань': [55.8304, 49.0661],
    'Нижний Новгород': [56.2965, 43.9361],
    'Краснодар': [45.0393, 38.9872],
    'Самара': [53.2415, 50.2212],
    'Челябинск': [55.1644, 61.4368],
    'Ростов-на-Дону': [47.2357, 39.7015],
    'Уфа': [54.7388, 55.9721],
    'Омск': [54.9885, 73.3242],
    'Красноярск': [56.0153, 92.8932],
    'Воронеж': [51.6755, 39.2089],
    'Пермь': [58.0105, 56.2502],
    'Волгоград': [48.7080, 44.5133],
    'Тюмень': [57.1613, 65.5250],
    'Сочи': [43.6028, 39.7342]
  };

  const state = {
    allPoints: [],
    loadedFullPoints: false,
    loadingFullPoints: false,
    activeCity: 'Москва',
    searchQuery: '',
    selectedPoint: null,
    onSelectCallback: null,
    leafletMap: null,
    markersLayer: null,
    isLeafletLoading: false,
    isLeafletReady: false,
    activeTab: 'map', // 'map' or 'list' for mobile
    isOpen: false
  };

  function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/ё/g, 'е').replace(/[^\w\dа-яa-z]/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  // Self-inject CSS styles if not already provided by page styles
  function ensureStylesInDOM() {
    let style = document.getElementById('cdekPickerCustomStyles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'cdekPickerCustomStyles';
      document.head.appendChild(style);
    }
    style.textContent = `
      #cdekMapModal.modal-backdrop,
      #cdekMapModal {
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.8) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        z-index: 2147483647 !important;
        display: none;
        align-items: center;
        justify-content: center;
        box-sizing: border-box !important;
      }
      #cdekMapModal.active {
        display: flex !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
      .cdek-modal-card {
        max-width: 1040px;
        width: 95vw;
        height: 88vh;
        max-height: 850px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        background: #12151c;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
        border-radius: 16px;
        position: relative;
        box-sizing: border-box;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #ffffff;
      }
      .cdek-modal-card .btn-close-modal {
        position: absolute;
        top: 18px;
        right: 18px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #fff;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        z-index: 10;
        transition: all 0.2s;
      }
      .cdek-modal-card .btn-close-modal:hover {
        background: rgba(255, 255, 255, 0.18);
        transform: rotate(90deg);
      }
      .cdek-modal-header {
        flex-shrink: 0;
        margin-bottom: 12px;
      }
      .cdek-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(43, 112, 240, 0.12);
        border: 1px solid rgba(43, 112, 240, 0.28);
        border-radius: 20px;
        color: #60a5fa;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .cdek-toolbar {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 12px;
      }
      .cdek-search-wrap {
        position: relative;
        width: 100%;
      }
      .cdek-search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(255, 255, 255, 0.4);
        pointer-events: none;
      }
      .cdek-search-input {
        width: 100%;
        box-sizing: border-box;
        height: 44px;
        padding: 0 40px 0 42px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 10px;
        color: #fff;
        font-size: 0.9375rem;
        font-family: inherit;
        outline: none;
      }
      .cdek-search-input:focus {
        border-color: #2b70f0;
        background: rgba(255, 255, 255, 0.08);
      }
      .cdek-clear-search-btn {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        padding: 6px;
        font-size: 14px;
        border-radius: 50%;
      }
      .cdek-city-pills {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding: 2px 0 6px;
        max-width: 100%;
        box-sizing: border-box;
      }
      .cdek-city-pills::-webkit-scrollbar { display: none; }
      .cdek-city-pill {
        flex-shrink: 0;
        white-space: nowrap;
        padding: 6px 14px;
        min-height: 36px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .cdek-city-pill:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.2);
      }
      .cdek-city-pill.active {
        background: #2b70f0;
        border-color: #2b70f0;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(43, 112, 240, 0.35);
      }
      .cdek-mobile-tabs {
        display: none;
        margin-bottom: 10px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 4px;
        gap: 4px;
      }
      .cdek-tab-btn {
        flex: 1;
        min-height: 40px;
        background: none;
        border: none;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .cdek-tab-btn.active {
        background: #2b70f0;
        color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      }
      .cdek-modal-body {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 440px 1fr;
        gap: 16px;
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #090b10;
      }
      .cdek-list-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        background: rgba(255, 255, 255, 0.02);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
      }
      .cdek-list-header {
        padding: 12px 16px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.2);
      }
      .cdek-points-scroll {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cdek-point-card {
        padding: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cdek-point-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(43, 112, 240, 0.4);
        transform: translateY(-1px);
      }
      .cdek-point-card.selected {
        background: rgba(43, 112, 240, 0.12);
        border-color: #2b70f0;
        box-shadow: 0 0 0 1px #2b70f0;
      }
      .cdek-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .cdek-card-code {
        font-family: monospace;
        font-size: 0.8125rem;
        font-weight: 700;
        padding: 2px 6px;
        background: rgba(43, 112, 240, 0.18);
        border-radius: 4px;
        color: #60a5fa;
      }
      .cdek-card-metro {
        font-size: 0.75rem;
        color: #10b981;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cdek-card-city {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
      }
      .cdek-card-address {
        font-size: 0.875rem;
        font-weight: 600;
        color: #ffffff;
        line-height: 1.35;
      }
      .cdek-card-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.55);
      }
      .cdek-card-action { margin-top: 4px; }
      .cdek-card-btn {
        width: 100%;
        min-height: 34px;
        padding: 6px 12px;
        background: rgba(43, 112, 240, 0.15);
        border: 1px solid rgba(43, 112, 240, 0.35);
        border-radius: 6px;
        color: #60a5fa;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .cdek-card-btn:hover {
        background: #2b70f0;
        border-color: #2b70f0;
        color: #fff;
      }
      .cdek-map-panel {
        position: relative;
        height: 100%;
        width: 100%;
        min-height: 300px;
      }
      .cdek-leaflet-container {
        height: 100%;
        width: 100%;
        background: #11141c;
      }
      .cdek-map-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.875rem;
        pointer-events: none;
        background: rgba(11, 13, 17, 0.85);
        padding: 16px 24px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 500;
      }
      .cdek-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid rgba(43, 112, 240, 0.25);
        border-top-color: #2b70f0;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      .cdek-modal-footer {
        flex-shrink: 0;
        margin-top: 12px;
        padding: 12px 16px;
        background: rgba(43, 112, 240, 0.08);
        border: 1px solid rgba(43, 112, 240, 0.25);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .cdek-selected-summary {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .cdek-selected-code {
        font-family: monospace;
        font-weight: 700;
        color: #60a5fa;
        font-size: 0.8125rem;
      }
      .cdek-selected-address {
        font-weight: 600;
        color: #fff;
        font-size: 0.875rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cdek-selected-sub {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.6);
      }
      .cdek-btn-confirm {
        flex-shrink: 0;
        min-height: 44px;
        padding: 0 20px;
        background: #2b70f0;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        font-size: 0.875rem;
        white-space: nowrap;
      }
      .cdek-leaflet-popup .leaflet-popup-content-wrapper {
        background: #14171f;
        color: #ffffff;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
        padding: 0;
      }
      .cdek-leaflet-popup .leaflet-popup-content { margin: 12px 14px; line-height: 1.4; }
      .cdek-leaflet-popup .leaflet-popup-tip { background: #14171f; }
      .cdek-popup-card { display: flex; flex-direction: column; gap: 6px; font-family: sans-serif; }
      .cdek-popup-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .cdek-popup-code { font-family: monospace; font-weight: 700; color: #60a5fa; font-size: 0.8125rem; }
      .cdek-popup-city { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); }
      .cdek-popup-address { font-size: 0.875rem; font-weight: 600; color: #ffffff; }
      .cdek-popup-metro { font-size: 0.75rem; color: #10b981; }
      .cdek-popup-hours { font-size: 0.75rem; color: rgba(255, 255, 255, 0.6); }
      .cdek-popup-select-btn {
        margin-top: 4px;
        width: 100%;
        min-height: 36px;
        background: #2b70f0;
        border: none;
        border-radius: 6px;
        color: #fff;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }
      @media (max-width: 768px) {
        .cdek-modal-card {
          padding: 16px 12px;
          height: 94vh;
          max-height: none;
          width: 96vw;
        }
        .cdek-mobile-tabs { display: flex; }
        .cdek-modal-body { grid-template-columns: 1fr; min-height: 0; flex: 1; }
        .cdek-list-panel, .cdek-map-panel { display: none; height: 100%; min-height: 0; }
        .cdek-map-panel.mobile-visible { display: block; }
        .cdek-list-panel.mobile-visible { display: flex; flex-direction: column; border-right: none; }
        .cdek-modal-footer { flex-direction: column; align-items: stretch; gap: 10px; }
        .cdek-btn-confirm { width: 100%; }
      }
      @media (max-width: 380px) {
        .cdek-modal-card { padding: 12px 8px; width: 98vw; }
      }
      @keyframes spin { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  // Ensure modal HTML markup exists in document.body
  function ensureModalInDOM() {
    ensureStylesInDOM();

    let modal = document.getElementById('cdekMapModal');
    if (modal) {
      if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
      }
      modal.style.setProperty('z-index', '2147483647', 'important');
      modal.style.setProperty('position', 'fixed', 'important');
      return modal;
    }

    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.id = 'cdekMapModal';
    modal.style.setProperty('z-index', '2147483647', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    modal.onclick = function(event) {
      if (event.target === this) {
        event.stopPropagation();
        closeModal();
      }
    };

    modal.innerHTML = `
      <div class="modal-card cdek-modal-card">
        <button class="btn-close-modal" onclick="window.geekNookCdekPicker.close()" aria-label="Закрыть окно">✕</button>
        
        <div class="cdek-modal-header">
          <div class="cdek-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            СДЭК Доставка
          </div>
          <h2 class="modal-title" style="font-size:1.6rem;margin-top:6px;margin-bottom:4px;">Пункты выдачи СДЭК (ПВЗ)</h2>
          <p class="modal-subtitle" style="margin-bottom:12px;font-size:0.875rem;">Выберите пункт на интерактивной карте или найдите по адресу, метро или коду ПВЗ</p>
        </div>

        <div class="cdek-toolbar">
          <div class="cdek-search-wrap">
            <svg class="cdek-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="cdekSearchInput" class="cdek-search-input" placeholder="Поиск по адресу, метро, городу или коду (напр. Тверская или MSK...)" autocomplete="off" />
            <button type="button" id="cdekClearSearch" class="cdek-clear-search-btn" style="display:none;" aria-label="Очистить поиск">✕</button>
          </div>

          <div class="cdek-city-pills" id="cdekCityPills">
            <button type="button" class="cdek-city-pill active" data-city="Москва">Москва</button>
            <button type="button" class="cdek-city-pill" data-city="Санкт-Петербург">Санкт-Петербург</button>
            <button type="button" class="cdek-city-pill" data-city="Новосибирск">Новосибирск</button>
            <button type="button" class="cdek-city-pill" data-city="Екатеринбург">Екатеринбург</button>
            <button type="button" class="cdek-city-pill" data-city="Казань">Казань</button>
            <button type="button" class="cdek-city-pill" data-city="Нижний Новгород">Нижний Новгород</button>
            <button type="button" class="cdek-city-pill" data-city="Краснодар">Краснодар</button>
            <button type="button" class="cdek-city-pill" data-city="Самара">Самара</button>
            <button type="button" class="cdek-city-pill" data-city="all">Все города</button>
          </div>
        </div>

        <div class="cdek-mobile-tabs" id="cdekMobileTabs">
          <button type="button" class="cdek-tab-btn active" data-tab="map">🗺️ Карта ПВЗ</button>
          <button type="button" class="cdek-tab-btn" data-tab="list">📋 Список (<span id="cdekPointsCount">0</span>)</button>
        </div>

        <div class="cdek-modal-body">
          <div class="cdek-list-panel" id="cdekListPanel">
            <div class="cdek-list-header">
              <span id="cdekResultsHeading">Пункты выдачи в г. Москва</span>
            </div>
            <div class="cdek-points-scroll" id="cdekPointsScroll"></div>
          </div>

          <div class="cdek-map-panel mobile-visible" id="cdekMapPanel">
            <div id="cdekLeafletMap" class="cdek-leaflet-container"></div>
            <div class="cdek-map-loading" id="cdekMapLoading">
              <div class="cdek-spinner"></div>
              <span>Загрузка интерактивной карты...</span>
            </div>
          </div>
        </div>

        <div class="cdek-modal-footer" id="cdekModalFooter" style="display:none;">
          <div class="cdek-selected-summary">
            <div class="cdek-selected-code" id="cdekSelectedCode">MSK142</div>
            <div class="cdek-selected-address" id="cdekSelectedAddress">ул. Тверская, д. 9</div>
            <div class="cdek-selected-sub" id="cdekSelectedSub">Пн-Вс 10:00-21:00</div>
          </div>
          <button type="button" class="btn-checkout cdek-btn-confirm" id="cdekBtnConfirm" onclick="window.geekNookCdekPicker.confirmSelection()">
            Выбрать этот пункт
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    setupEvents();
    return modal;
  }

  // Load Leaflet dynamically on demand
  function ensureLeafletLoaded(callback) {
    if (window.L && typeof window.L.map === 'function') {
      state.isLeafletReady = true;
      if (callback) callback();
      return;
    }

    if (state.isLeafletLoading) {
      const checkInterval = setInterval(function() {
        if (window.L && typeof window.L.map === 'function') {
          clearInterval(checkInterval);
          state.isLeafletReady = true;
          if (callback) callback();
        }
      }, 100);
      return;
    }

    state.isLeafletLoading = true;

    // Inject CSS
    if (!document.getElementById('leafletCss')) {
      const link = document.createElement('link');
      link.id = 'leafletCss';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = function() {
      state.isLeafletReady = true;
      state.isLeafletLoading = false;
      if (callback) callback();
    };
    script.onerror = function() {
      state.isLeafletLoading = false;
      console.warn('[GeekNook CDEK] Failed to load Leaflet library, fallback to list view.');
      if (callback) callback();
    };
    document.head.appendChild(script);
  }

  // Initialize data from bundled popular points + lazy-load full catalog
  function initData() {
    if (window.GEEKNOOK_CDEK_POPULAR && Array.isArray(window.GEEKNOOK_CDEK_POPULAR)) {
      state.allPoints = window.GEEKNOOK_CDEK_POPULAR;
    }

    // Preload full database in idle time
    if (!state.loadedFullPoints && !state.loadingFullPoints) {
      state.loadingFullPoints = true;
      const cdnBase = window.GEEKNOOK_CDN_URL || '';
      const jsonUrl = (cdnBase ? (cdnBase.endsWith('/') ? cdnBase : cdnBase + '/') : '') + 'js/data/cdek-points.json';

      fetch(jsonUrl)
        .then(r => {
          if (!r.ok) throw new Error('CDEK points json status: ' + r.status);
          return r.json();
        })
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            state.allPoints = data;
            state.loadedFullPoints = true;
            if (state.isOpen) {
              renderPoints();
              updateMapMarkers();
            }
          }
        })
        .catch(err => {
          console.warn('[GeekNook CDEK] Could not fetch full points json, running on popular bundle.', err.message);
        })
        .finally(() => {
          state.loadingFullPoints = false;
        });
    }
  }

  // Filter points matching active city and search query
  function getFilteredPoints() {
    const q = normalize(state.searchQuery);
    const city = state.activeCity;

    return state.allPoints.filter(p => {
      // If a search query is present, search everywhere or in city
      if (q) {
        const text = normalize(`${p.c} ${p.ct} ${p.a} ${p.m || ''}`);
        if (!text.includes(q)) return false;
      }

      // If activeCity is not 'all', restrict to city unless searching across all
      if (city !== 'all' && !q) {
        if (p.ct !== city) return false;
      } else if (city !== 'all' && q) {
        const queryHasCity = q.length > 3 && (q.includes('моск') || q.includes('питер') || q.includes('казан') || q.includes('екат') || q.includes('новосиб'));
        if (!queryHasCity && p.ct !== city && !q.includes(normalize(p.ct))) {
          // Keep search focused unless empty
        }
      }

      return true;
    });
  }

  // Initialize or re-center Leaflet Map
  function initMap() {
    const container = document.getElementById('cdekLeafletMap');
    if (!container || !window.L) return;

    if (!state.leafletMap) {
      const defaultCoords = CITY_COORDINATES[state.activeCity] || [55.7558, 37.6173];
      state.leafletMap = window.L.map('cdekLeafletMap', {
        center: defaultCoords,
        zoom: 11,
        zoomControl: true,
        attributionControl: false
      });

      // OpenStreetMap standard clean tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(state.leafletMap);

      // Attribution small
      window.L.control.attribution({
        position: 'bottomright',
        prefix: '<a href="https://cdek.ru" target="_blank" rel="noopener">СДЭК</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(state.leafletMap);

      state.markersLayer = window.L.layerGroup().addTo(state.leafletMap);
    }

    const loader = document.getElementById('cdekMapLoading');
    if (loader) loader.style.display = 'none';

    setTimeout(() => {
      if (state.leafletMap) {
        state.leafletMap.invalidateSize();
        updateMapMarkers();
      }
    }, 150);
  }

  // Custom GeekNook CDEK Marker Icon
  function createCustomIcon(isSelected) {
    if (!window.L) return null;
    const bg = isSelected ? '#10b981' : '#2b70f0';
    const border = '#ffffff';
    const svg = `
      <svg width="28" height="34" viewBox="0 0 28 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 20 14 20s14-9.5 14-20c0-7.732-6.268-14-14-14z" fill="${bg}"/>
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 20 14 20s14-9.5 14-20c0-7.732-6.268-14-14-14z" stroke="${border}" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5" fill="#ffffff"/>
      </svg>
    `;
    return window.L.divIcon({
      className: 'cdek-map-pin',
      html: svg,
      iconSize: [28, 34],
      iconAnchor: [14, 34],
      popupAnchor: [0, -32]
    });
  }

  // Update markers on the map for visible points
  function updateMapMarkers() {
    if (!state.leafletMap || !state.markersLayer || !window.L) return;

    state.markersLayer.clearLayers();
    const points = getFilteredPoints();

    // Limit to 150 points on map to avoid DOM cluttering & maintain 60 FPS
    const mapPoints = points.slice(0, 150);
    const bounds = [];

    mapPoints.forEach(p => {
      if (!p.lat || !p.lon) return;
      bounds.push([p.lat, p.lon]);

      const isSel = state.selectedPoint && state.selectedPoint.c === p.c;
      const marker = window.L.marker([p.lat, p.lon], {
        icon: createCustomIcon(isSel),
        title: `${p.c} - ${p.a}`
      });

      const popupHtml = `
        <div class="cdek-popup-card">
          <div class="cdek-popup-header">
            <span class="cdek-popup-code">${escapeHTML(p.c)}</span>
            <span class="cdek-popup-city">${escapeHTML(p.ct)}</span>
          </div>
          <div class="cdek-popup-address">${escapeHTML(p.a)}</div>
          ${p.m ? `<div class="cdek-popup-metro">Ⓜ ${escapeHTML(p.m)}</div>` : ''}
          <div class="cdek-popup-hours">🕒 ${escapeHTML(p.w)}</div>
          <button type="button" class="cdek-popup-select-btn" onclick="window.geekNookCdekPicker.selectAndConfirm('${p.c}')">
            Выбрать этот пункт
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'cdek-leaflet-popup',
        maxWidth: 280,
        minWidth: 220
      });

      marker.on('click', () => {
        selectPoint(p.c, false);
      });

      state.markersLayer.addLayer(marker);
    });

    if (bounds.length > 0 && (!state.searchQuery || state.searchQuery.length > 2)) {
      try {
        state.leafletMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      } catch (e) {}
    } else if (CITY_COORDINATES[state.activeCity]) {
      state.leafletMap.setView(CITY_COORDINATES[state.activeCity], 11);
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Render the list of points
  function renderPoints() {
    const scrollEl = document.getElementById('cdekPointsScroll');
    const headingEl = document.getElementById('cdekResultsHeading');
    const countEl = document.getElementById('cdekPointsCount');
    if (!scrollEl) return;

    const points = getFilteredPoints();

    if (countEl) countEl.textContent = String(points.length);
    if (headingEl) {
      if (state.searchQuery) {
        headingEl.textContent = `Найдено: ${points.length} ПВЗ`;
      } else if (state.activeCity === 'all') {
        headingEl.textContent = `Все пункты выдачи (${points.length})`;
      } else {
        headingEl.textContent = `Пункты выдачи в г. ${state.activeCity} (${points.length})`;
      }
    }

    if (points.length === 0) {
      scrollEl.innerHTML = `
        <div class="cdek-empty-state">
          <div class="cdek-empty-icon">🔍</div>
          <div class="cdek-empty-title">Пункт выдачи не найден</div>
          <div class="cdek-empty-desc">Попробуйте изменить запрос или выберите другой город из списка выше.</div>
        </div>
      `;
      return;
    }

    const visibleList = points.slice(0, 100);
    scrollEl.innerHTML = visibleList.map(p => {
      const isSelected = state.selectedPoint && state.selectedPoint.c === p.c;
      return `
        <div class="cdek-point-card ${isSelected ? 'selected' : ''}" id="cdekPoint_${p.c}" onclick="window.geekNookCdekPicker.selectPoint('${p.c}')">
          <div class="cdek-card-top">
            <span class="cdek-card-code">${escapeHTML(p.c)}</span>
            ${p.m ? `<span class="cdek-card-metro">Ⓜ ${escapeHTML(p.m)}</span>` : `<span class="cdek-card-city">${escapeHTML(p.ct)}</span>`}
          </div>
          <div class="cdek-card-address">${escapeHTML(p.a)}</div>
          <div class="cdek-card-meta">
            <span class="cdek-card-hours">🕒 ${escapeHTML(p.w)}</span>
            <span class="cdek-card-phone">${escapeHTML(p.p || '+7 800 250-04-05')}</span>
          </div>
          <div class="cdek-card-action">
            <button type="button" class="cdek-card-btn ${isSelected ? 'active' : ''}" onclick="event.stopPropagation(); window.geekNookCdekPicker.selectAndConfirm('${p.c}')">
              ${isSelected ? '✓ Выбран' : 'Выбрать этот пункт'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (points.length > 100) {
      const moreMsg = document.createElement('div');
      moreMsg.className = 'cdek-more-notice';
      moreMsg.textContent = `Показано 100 из ${points.length} пунктов. Уточните запрос в поиске для быстрого нахождения.`;
      scrollEl.appendChild(moreMsg);
    }
  }

  // Select a point
  function selectPoint(code, closePopupAndCenter = true) {
    const point = state.allPoints.find(p => p.c === code);
    if (!point) return;

    state.selectedPoint = point;

    // Update bottom footer bar
    const footer = document.getElementById('cdekModalFooter');
    const codeEl = document.getElementById('cdekSelectedCode');
    const addrEl = document.getElementById('cdekSelectedAddress');
    const subEl = document.getElementById('cdekSelectedSub');

    if (footer && codeEl && addrEl) {
      codeEl.textContent = point.c;
      addrEl.textContent = `${point.ct}, ${point.a}`;
      if (subEl) subEl.textContent = `Режим: ${point.w}${point.m ? ` • Метро: ${point.m}` : ''}`;
      footer.style.display = 'flex';
    }

    // Update active class in list
    document.querySelectorAll('.cdek-point-card').forEach(el => el.classList.remove('selected'));
    const card = document.getElementById(`cdekPoint_${code}`);
    if (card) {
      card.classList.add('selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Center map on point if requested
    if (closePopupAndCenter && state.leafletMap && point.lat && point.lon) {
      state.leafletMap.setView([point.lat, point.lon], 15, { animate: true });
    }
  }

  // Confirm selection and dispatch to caller
  function confirmSelection() {
    if (!state.selectedPoint) return;
    const p = state.selectedPoint;

    const payload = {
      code: p.c,
      city: p.ct,
      address: p.a,
      fullText: `${p.ct}, ${p.a} (ПВЗ СДЭК: ${p.c})`,
      workTime: p.w,
      metro: p.m,
      phone: p.p,
      lat: p.lat,
      lon: p.lon
    };

    if (typeof state.onSelectCallback === 'function') {
      state.onSelectCallback(payload);
    }

    // Dispatch global event
    try {
      window.dispatchEvent(new CustomEvent('geeknook:pvz_selected', { detail: payload }));
    } catch (e) {}

    closeModal();
  }

  // 1-Click Select and Confirm
  function selectAndConfirm(code) {
    selectPoint(code, false);
    confirmSelection();
  }

  // Open the modal
  function openModal(callback) {
    state.onSelectCallback = callback || null;
    state.isOpen = true;

    initData();

    const modal = ensureModalInDOM();
    if (!modal) {
      console.error('[GeekNook CDEK] Failed to initialize modal in DOM.');
      return;
    }

    // Always re-append to end of document.body on open to ensure it is topmost in DOM order
    document.body.appendChild(modal);
    modal.style.setProperty('z-index', '2147483647', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Reset search
    state.searchQuery = '';
    const searchInp = document.getElementById('cdekSearchInput');
    if (searchInp) searchInp.value = '';
    const clearBtn = document.getElementById('cdekClearSearch');
    if (clearBtn) clearBtn.style.display = 'none';

    renderPoints();

    // Ensure Leaflet is loaded and map initialized
    ensureLeafletLoaded(() => {
      initMap();
    });

    // Analytics goal
    if (window.geekNookAnalytics && typeof window.geekNookAnalytics.trackCdekMapClick === 'function') {
      window.geekNookAnalytics.trackCdekMapClick();
    }
  }

  // Close the modal
  function closeModal() {
    state.isOpen = false;
    const modal = document.getElementById('cdekMapModal');
    if (modal) modal.classList.remove('active');
    const otherModals = document.querySelectorAll('.modal-backdrop.active:not(#cdekMapModal)');
    if (otherModals.length === 0 && !document.querySelector('.t706__cartwin_showed')) {
      document.body.classList.remove('modal-open');
    }
  }

  // Switch City
  function setCity(city) {
    state.activeCity = city;

    // Update pill styles
    document.querySelectorAll('.cdek-city-pill').forEach(btn => {
      if (btn.getAttribute('data-city') === city) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    renderPoints();

    if (state.leafletMap && CITY_COORDINATES[city]) {
      state.leafletMap.setView(CITY_COORDINATES[city], 11, { animate: true });
    }
    updateMapMarkers();
  }

  // Setup DOM event listeners
  function setupEvents() {
    // City pills
    const pillsContainer = document.getElementById('cdekCityPills');
    if (pillsContainer) {
      pillsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.cdek-city-pill');
        if (btn) {
          const city = btn.getAttribute('data-city');
          if (city) setCity(city);
        }
      });
    }

    // Search input
    const searchInp = document.getElementById('cdekSearchInput');
    const clearBtn = document.getElementById('cdekClearSearch');
    if (searchInp) {
      let debounceTimer = null;
      searchInp.addEventListener('input', () => {
        const val = searchInp.value.trim();
        state.searchQuery = val;
        if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderPoints();
          updateMapMarkers();
        }, 200);
      });
    }

    if (clearBtn && searchInp) {
      clearBtn.addEventListener('click', () => {
        searchInp.value = '';
        state.searchQuery = '';
        clearBtn.style.display = 'none';
        renderPoints();
        updateMapMarkers();
        searchInp.focus();
      });
    }

    // Mobile tabs (Map vs List)
    const mobileTabs = document.getElementById('cdekMobileTabs');
    if (mobileTabs) {
      mobileTabs.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.cdek-tab-btn');
        if (tabBtn) {
          const tab = tabBtn.getAttribute('data-tab');
          if (tab) {
            state.activeTab = tab;
            mobileTabs.querySelectorAll('.cdek-tab-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');

            const mapPanel = document.getElementById('cdekMapPanel');
            const listPanel = document.getElementById('cdekListPanel');

            if (mapPanel && listPanel) {
              if (tab === 'map') {
                mapPanel.classList.add('mobile-visible');
                listPanel.classList.remove('mobile-visible');
                if (state.leafletMap) {
                  setTimeout(() => state.leafletMap.invalidateSize(), 100);
                }
              } else {
                mapPanel.classList.remove('mobile-visible');
                listPanel.classList.add('mobile-visible');
              }
            }
          }
        }
      });
    }
  }

  // Initialize on DOM ready
  ensureStylesInDOM();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureStylesInDOM();
      initData();
      setupEvents();
    });
  } else {
    ensureStylesInDOM();
    initData();
    setupEvents();
  }

  // Expose public API
  window.geekNookCdekPicker = {
    open: openModal,
    close: closeModal,
    setCity: setCity,
    selectPoint: selectPoint,
    confirmSelection: confirmSelection,
    selectAndConfirm: selectAndConfirm,
    ensureModalInDOM: ensureModalInDOM,
    getState: () => ({ ...state })
  };

})(window);
