(() => {
  const catalog = typeof FOCUS_COMPARISON_CATALOG === 'undefined' ? null : FOCUS_COMPARISON_CATALOG;
  const productCards = [...document.querySelectorAll('.size-card')];
  const cart = document.querySelector('#cart');
  const cartToggle = document.querySelector('#open-cart');
  const buyButton = document.querySelector('#add-to-cart');
  const purchaseName = document.querySelector('#purchase-name');
  const purchaseMeta = document.querySelector('#purchase-meta');
  const currency = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  });
  const cartEntries = new Map();
  const events = [];
  let selected = null;

  // Keep both end sections (including the feet) and project only the span between them.
  const photo = new Image();
  photo.src = '../../images/focus-station-cutout.png';
  photo.decode().then(() => {
    const inset = 2;
    const endWidth = 175;
    const photoWidth = photo.naturalWidth - inset * 2;
    const photoHeight = photo.naturalHeight - inset * 2;
    const middleWidth = photoWidth - endWidth * 2;

    for (const card of productCards) {
      const canvas = card.querySelector('canvas');
      canvas.width = Math.round(photoWidth * Number(card.dataset.size) / 116);
      canvas.height = photoHeight;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(photo, inset, inset, endWidth, photoHeight, 0, 0, endWidth, photoHeight);
      context.drawImage(photo, inset + endWidth, inset, middleWidth, photoHeight,
        endWidth, 0, canvas.width - endWidth * 2, photoHeight);
      context.drawImage(photo, inset + photoWidth - endWidth, inset, endWidth, photoHeight,
        canvas.width - endWidth, 0, endWidth, photoHeight);
    }
  }).catch(() => {
    document.querySelectorAll('.product canvas').forEach(canvas => { canvas.hidden = true; });
    document.querySelector('.visual-caption span').textContent = 'Линейки в едином масштабе';
  });

  if (!catalog || productCards.some(card => !catalog.variants.some(variant => variant.size === Number(card.dataset.size)))) {
    document.querySelector('#load-error').hidden = false;
    return;
  }

  // Preview events stay in this page and never reach the shop's analytics.
  window.focusStationComparisonEvents = events;
  function record(event, variant) {
    const entry = { event, item_id: catalog.id, currency: 'RUB' };
    if (variant) Object.assign(entry, { item_variant: variant.option, sku: variant.sku, price: variant.price });
    events.push(entry);
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    record('focus_station_compare_view');
    observer.disconnect();
  });
  observer.observe(document.querySelector('.visual-caption'));

  for (const card of productCards) {
    const variant = catalog.variants.find(item => item.size === Number(card.dataset.size));
    const choose = card.querySelector('.choose-size');
    card.querySelector('[data-catalog-price]').textContent = currency.format(variant.listPrice);
    card.querySelector('[data-price]').textContent = currency.format(variant.price);
    choose.disabled = false;
    choose.addEventListener('click', () => {
      if (selected === variant) return;
      selected = variant;
      for (const other of productCards) {
        const button = other.querySelector('.choose-size');
        const isSelected = other === card;
        button.setAttribute('aria-pressed', isSelected);
        button.firstElementChild.textContent = `${isSelected ? 'Выбрано' : 'Выбрать'} ${other.dataset.size} см`;
      }
      purchaseName.textContent = `Орех · ${variant.option}`;
      purchaseMeta.textContent = currency.format(variant.price);
      buyButton.disabled = false;
      record('focus_station_size_select', variant);
    });
  }

  function renderCart() {
    const cartList = document.querySelector('#cart-items');
    const total = document.querySelector('#cart-total');
    let quantity = 0;
    let amount = 0;
    cartList.replaceChildren();

    for (const variant of catalog.variants) {
      const count = cartEntries.get(variant.sku);
      if (!count) continue;
      quantity += count;
      const linePrice = variant.price * count;
      amount += linePrice;
      const row = document.querySelector('#cart-row').content.cloneNode(true);
      row.querySelector('[data-cart-title]').textContent = catalog.title;
      row.querySelector('[data-cart-variant]').textContent = `${variant.option} · ${count} шт.`;
      row.querySelector('[data-cart-price]').textContent = currency.format(linePrice);
      cartList.append(row);
    }

    document.querySelector('#cart-count').textContent = quantity;
    document.querySelector('#cart-empty').hidden = quantity > 0;
    total.hidden = quantity === 0;
    total.querySelector('strong').textContent = currency.format(amount);
  }

  buyButton.addEventListener('click', () => {
    if (!selected) return;
    cartEntries.set(selected.sku, (cartEntries.get(selected.sku) || 0) + 1);
    record('focus_station_add_to_cart', selected);
    renderCart();
    cart.showModal();
  });
  cartToggle.disabled = false;
  cartToggle.addEventListener('click', () => cart.showModal());
})();
