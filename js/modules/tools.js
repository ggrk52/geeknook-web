/**
 * GeekNook Module: Tools & Applications
 * Spotlight Command Palette (Cmd+K), Interactive Setup Finder Quiz, shareable configurator link, and initialization coordinator.
 */
window.GeekNook = window.GeekNook || {};

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
          { val: 'laptop_only', title: 'Один ноутбук (13–16")', desc: 'Компактное рабочее место, акцент на мобильность и минимализм', shelf: '65', shelfTitle: 'Focus Station 650 (Компакт)' },
          { val: 'laptop_monitor', title: 'Ноутбук + Монитор 27–32"', desc: 'Самый популярный баланс для разработки, дизайна и аналитики', shelf: '85', shelfTitle: 'Focus Station 900 (Стандарт 85 см)' },
          { val: 'dual_ultrawide', title: 'Два монитора или Ultrawide 34–49"', desc: 'Широкая рабочая плоскость, требуется основание 120 см', shelf: '120', shelfTitle: 'Focus Station 1200 (Макси)' },
          { val: 'creative_studio', title: 'Ноутбук + Планшет/Звуковая карта', desc: 'Сетап креатора: стриминг, аудиомонтаж или иллюстрация', shelf: '85', shelfTitle: 'Focus Station 900 (Стандарт 85 см)' }
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

    const recommendedShelfId = step1Choice.shelf === '65' ? 'focus-station-650' : (step1Choice.shelf === '120' ? 'focus-station-1200' : 'focus-station-900');
    const shelfProduct = GEEKNOOK_DATA.boards.find(b => b.id === recommendedShelfId) || GEEKNOOK_DATA.boards[0];

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

    const itemsTotal = shelfProduct.price + addonList.reduce((s, a) => s + a.price, 0) + (recommendedMat ? recommendedMat.price : 0);

    state.quizBundle = {
      shelf: shelfProduct,
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
          <img class="quiz-result-shelf-img" src="${shelfProduct.images[0]}" alt="${shelfProduct.title}" />
          <div>
            <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--primary);font-weight:700;text-transform:uppercase;">Базовая станция</div>
            <div style="font-weight:800;font-size:1.05rem;">${shelfProduct.title}</div>
            <div style="font-size:0.8125rem;color:var(--text-muted);">${shelfProduct.shortDescr || ''}</div>
            <div style="font-family:var(--font-mono);font-weight:700;color:var(--text-main);margin-top:4px;">${formatPrice(shelfProduct.price)}</div>
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
    const { shelf, addons, mat } = state.quizBundle;

    addToCart(shelf.id, 'Стандарт', false);
    addons.forEach(a => addToCart(a.id, 'Стандарт', false));
    if (mat) addToCart(mat.id, 'Стандарт', false);

    saveCart();
    triggerBadgeBounce();
    closeModal('quizModal');
    showToast('Персональный комплект добавлен в корзину!', 'success');
    openCartDrawer();
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

  // --- INITIALIZE APPLICATION ---
  const init = () => {
    // 1. Global image fallback (Capture phase handles non-bubbling img error events)
    window.addEventListener('error', (e) => {
      if (e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        if (!img.dataset.hasFallback) {
          img.dataset.hasFallback = 'true';
          img.src = 'images/tild3763-3337-4662-b233-616531316364__3.jpg';
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
  };

window.GeekNook.tools = {
  shareConfiguredSetup,
  openQuiz,
  renderQuizStep,
  selectQuizOption,
  prevQuizStep,
  addQuizBundleToCart,
  initHeroVideo,
  openCommandPalette,
  closeCommandPalette,
  executeCommand,
  init
};
