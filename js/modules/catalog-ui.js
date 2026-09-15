/**
 * GeekNook Module: Catalog UI
 * Product cards, 3D tilt effects, quick view, image lightboxes, journal articles, FAQ, and bundles.
 */
window.GeekNook = window.GeekNook || {};

  // --- PRODUCT CARD COMPONENT ---
  const renderProductCard = (p, idx = 0) => {
    const badgeHtml = p.badge ? `<span class="card-badge">${p.badge}</span>` : '';
    const oldPriceHtml = p.oldPrice ? `<span class="old-price">${formatPrice(p.oldPrice)}</span>` : '';
    const materialTag = p.materials ? p.materials.split(',')[0].trim() : 'Инженерный массив';
    const hasHoverImg = p.images && p.images.length > 1;

    return `
      <div class="product-item-card reveal-card" style="--stagger-delay: ${(idx % 4) * 0.08}s;" data-product-id="${p.id}">
        <div class="card-spotlight"></div>
        <div class="product-img-box" onclick="window.geekNookApp.openQuickView('${p.id}')">
          ${badgeHtml}
          <img class="card-img-main" src="${p.images[0]}" alt="${p.title}" loading="lazy" decoding="async" />
          ${hasHoverImg ? `<img class="card-img-hover" src="${p.images[1]}" alt="${p.title}" loading="lazy" decoding="async" />` : ''}
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
        <div class="card-meta-tag">${materialTag}</div>
        <h4 class="product-card-title" onclick="window.geekNookApp.openQuickView('${p.id}')">${p.title}</h4>
        <div class="product-card-sub">${p.subtitle || p.shortDescr || ''}</div>
        <div class="product-card-price">
          <span class="price-current">${formatPrice(p.price)}</span>
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
      <div class="prod-photo-item reveal-card" style="--stagger-delay: ${idx * 0.1}s;" onclick="window.geekNookApp.openLightbox('${p.src}', '${p.caption}')">
        <img src="${p.src}" alt="${p.caption}" loading="lazy" />
        <div class="prod-photo-caption">${p.caption}</div>
      </div>
    `).join('');
  };

  const renderClientSetups = () => {
    const wrap = document.getElementById('clientSetupsRow');
    if (!wrap || !GEEKNOOK_DATA.clientSetups) return;
    wrap.innerHTML = GEEKNOOK_DATA.clientSetups.map((s, idx) => `
      <div class="setup-review-card reveal-card" style="--stagger-delay: ${idx * 0.08}s;">
        <div class="setup-review-img-wrap" onclick="window.geekNookApp.openLightbox('${s.src}', '${s.title} • ${s.author}')">
          <img src="${s.src}" alt="${s.title}" loading="lazy" decoding="async" />
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
      <div class="gallery-tile-item reveal-card" style="--stagger-delay: ${idx * 0.08}s;" onclick="window.geekNookApp.openLightbox('${g.src}', '${g.title} — ${g.subtitle}')">
        <img src="${g.src}" alt="${g.title}" loading="lazy" decoding="async" />
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
          <img src="${art.image}" alt="${art.title}" loading="lazy" decoding="async" />
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
          <div style="font-size:0.8125rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Длина основания:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${product.options.lengths.map((len, idx) => `
              <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${len}" style="padding:6px 14px;border-radius:4px;border:1px solid var(--border);font-size:0.875rem;cursor:pointer;">${len}</button>
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
              <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${sz}" style="padding:6px 14px;border-radius:4px;border:1px solid var(--border);font-size:0.875rem;cursor:pointer;">${sz}</button>
            `).join('')}
          </div>
        </div>
      `;
    }

    const specsHtml = Object.entries(product.specs || {}).map(([k, v]) => `
      <tr>
        <td>${k}</td>
        <td>${v}</td>
      </tr>
    `).join('');

    content.innerHTML = `
      <div class="quick-view-grid">
        <div>
          <div class="quick-gallery-main">
            <img id="qvMainImg" src="${product.images[0]}" alt="${product.title}" />
          </div>
          <div class="quick-gallery-thumbs">
            ${product.images.map((img, idx) => `
              <img class="quick-thumb ${idx === 0 ? 'active' : ''}" src="${img}" onclick="window.geekNookApp.switchQvImage('${img}', this)" />
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
            <span style="font-family:var(--font-mono);font-size:1.85rem;font-weight:800;letter-spacing:-0.02em;color:var(--text-main);">${formatPrice(product.price)}</span>
            ${product.oldPrice ? `<span style="font-family:var(--font-mono);font-size:1.1rem;color:var(--text-subtle);text-decoration:line-through;">${formatPrice(product.oldPrice)}</span>` : ''}
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

    // Option chips click event
    content.querySelectorAll('.option-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        btn.parentElement.querySelectorAll('.option-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
    addToCart(productId, opt);
    closeModal('quickViewModal');
  };

  // --- LIGHTBOX GALLERY ---
  const openLightbox = (src, caption = '') => {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');
    if (!modal || !img) return;

    img.src = src;
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
    }
    document.querySelectorAll('.legal-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };

  // --- BUNDLES RENDERER & 1-CLICK ADD ---
  const renderBundles = () => {
    const container = document.getElementById('bundlesGrid');
    if (!container || !GEEKNOOK_DATA.bundles) return;

    container.innerHTML = GEEKNOOK_DATA.bundles.map(b => `
      <div class="bundle-card">
        <div class="bundle-badge-ribbon">${escapeHTML(b.badge)}</div>
        <div class="bundle-card-img-wrap">
          <img src="${b.image}" alt="${escapeHTML(b.title)}" class="bundle-card-img" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='images/tild3763-3337-4662-b233-616531316364__3.jpg'" />
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


window.GeekNook.catalogUi = {
  renderProductCard,
  renderCatalog,
  initCardTiltEffect,
  initScrollReveal,
  openQuickView,
  switchQvImage,
  addFromQuickView,
  openLightbox,
  openArticle,
  renderFAQ,
  toggleFAQ,
  openLegalModal,
  switchLegalTab,
  renderBundles,
  addBundleToCart,
  initBeforeAfterSlider,
  setTransformationSlider,
  scrollToProductionBlock,
  switchProductionTab,
  toggleHotspot
};
