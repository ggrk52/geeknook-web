/**
 * GeekNook Interactive CDEK PVZ Picker & Map Module
 * Zero-order-submission safety: Read-only PVZ selection and validation.
 * Supports Leaflet interactive map, fast client-side search, top cities preloading,
 * and seamless fallback down to 320px mobile viewports.
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
        // If user typed city name in query, don't restrict by city pill
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
    const border = isSelected ? '#ffffff' : '#ffffff';
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

  // Update markers on the map for visible points (up to 150 nearest for 60fps)
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
          <button type="button" class="cdek-popup-select-btn" onclick="window.geekNookCdekPicker.selectPoint('${p.c}')">
            Выбрать этот ПВЗ
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

    // Render up to 100 in list for fast scrolling
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
            <button type="button" class="cdek-card-btn ${isSelected ? 'active' : ''}">
              ${isSelected ? '✓ Выбран' : 'Выбрать этот ПВЗ'}
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

  // Open the modal
  function openModal(callback) {
    state.onSelectCallback = callback || null;
    state.isOpen = true;

    initData();

    const modal = document.getElementById('cdekMapModal');
    if (!modal) {
      console.error('[GeekNook CDEK] cdekMapModal element not found in DOM.');
      return;
    }

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
    document.body.classList.remove('modal-open');
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initData();
      setupEvents();
    });
  } else {
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
    getState: () => ({ ...state })
  };

})(window);
