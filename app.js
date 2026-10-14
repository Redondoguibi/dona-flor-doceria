'use strict';
(() => {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const menuBtn = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-menu]');
  if (menuBtn && nav) {
    function closeMenu() {
      nav.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.querySelector('.sr-only').textContent = 'Abrir menu';
    }
    menuBtn.addEventListener('click', () => {
      const opened = menuBtn.getAttribute('aria-expanded') !== 'true';
      nav.classList.toggle('is-open', opened);
      menuBtn.setAttribute('aria-expanded', String(opened));
      menuBtn.querySelector('.sr-only').textContent = opened ? 'Fechar menu' : 'Abrir menu';
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', e => {
      if (menuBtn.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
    });
  }

  // The catalog is self-contained and works even when the HTML is opened from disk.
  const catalog = Array.isArray(window.DONA_FLOR_CATALOGO) ? window.DONA_FLOR_CATALOGO : [];
  // Descrições dos produtos que possuem informações disponíveis.
  const productDetails = Object.freeze({
    'Doces|Bolos|ALPINO': {
      description: 'Bolo de chocolate com recheio inspirado no bombom Alpino e cobertura de ganache com pedaços do bombom.'
    },
    'Doces|Bolos|CHOCROCANTE': {
      description: 'Bolo de chocolate com recheio cremoso crocante, cobertura de marshmallow e crocante.'
    },
    'Doces|Bolos|BRIGADEIRO': {
      description: 'Massa de chocolate com recheio e cobertura de brigadeiro. A decoração pode variar.'
    },
    'Doces|Bolos|FLORESTA NEGRA': {
      description: 'Bolo de chocolate com brigadeiro, chantilly e cerejas, decorado com chocolate.'
    },
    'Doces|Bolos|MOUSSE DE DOCE DE LEITE': {
      description: 'Bolo de massa clara com mousse de doce de leite, marshmallow, calda de caramelo e crocante.'
    },
    'Doces|Tortas|AVELÃ': {
      description: 'Torta com pão de ló e mousse de avelã.'
    },
    'Doces|Tortas|BANOFFE': {
      description: 'Torta com base de biscoito, doce de leite, banana, chantilly e canela.'
    },
    'Doces|Tortas|LIMÃO': {
      description: 'Torta de limão com recheio de leite condensado e cobertura de suspiro.'
    }
  });
  const detailDialog = document.getElementById('produto-dialog');
  const detailTitle = document.getElementById('produto-dialog-titulo');
  const detailCategory = document.getElementById('produto-dialog-categoria');
  const detailDescription = document.getElementById('produto-dialog-descricao');
  const shareButton = document.getElementById('produto-dialog-compartilhar');
  const shareFeedback = document.getElementById('produto-dialog-feedback');
  let openedProduct = null, productOpener = null;
  function productLink(item) {
    const base = document.querySelector('link[rel=canonical]')?.href || location.href;
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || /^(localhost|127\.|\[::1\])/.test(url.hostname)) return null;
    url.hash = 'catalogo';
    url.searchParams.set('produto', [item.area,item.categoria,item.nome].join('|'));
    return url.href;
  }
  function openProduct(item, opener = document.activeElement) {
    productOpener = opener;
    if (!detailDialog || !detailTitle || !detailCategory || !detailDescription) return;
    openedProduct = item;
    if (shareFeedback) shareFeedback.textContent = '';
    const detail = productDetails[item.area + '|' + item.categoria + '|' + item.nome];
    detailTitle.textContent = item.nome;
    detailCategory.textContent = item.area + ' · ' + item.categoria;
    detailDescription.textContent = detail ? detail.description : 'A descrição deste produto ainda não está disponível. Consulte a unidade para informações sobre ingredientes, tamanhos, preços e disponibilidade.';
    detailDescription.hidden = false;
    if (typeof detailDialog.showModal === 'function') {
      if (!detailDialog.open) detailDialog.showModal();
    } else {
      detailDialog.setAttribute('open', '');
    }
  }
  detailDialog?.addEventListener('close', () => { if(productOpener?.isConnected) productOpener.focus(); });
  detailDialog?.addEventListener('click', e => {
    if (e.target === detailDialog) detailDialog.close();
  });
  shareButton?.addEventListener('click', async () => {
    if (!openedProduct) return;
    const link = productLink(openedProduct);
    if (!link) { shareFeedback.textContent = 'Esta prévia local não tem endereço público compartilhável. Abra o site hospedado para copiar o link.'; return; }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(link);
      if (shareFeedback) shareFeedback.textContent = 'Link copiado. Você pode compartilhar este produto.';
    } catch {
      if (shareFeedback) {
        shareFeedback.replaceChildren();
        const label = document.createElement('span');
        label.textContent = 'Copie o endereço do produto: ';
        const field = document.createElement('input');
        field.readOnly = true;
        field.value = link;
        field.setAttribute('aria-label','Endereço do produto');
        shareFeedback.append(label, field);
        field.focus();
        field.select();
      }
    }
  });
  const results = document.getElementById('catalogo-resultado');
  const search = document.getElementById('search');
  const subtype = document.getElementById('subcategory');
  const subtypeControl = document.querySelector('[data-subcategory-control]');
  const subtypeTrigger = document.querySelector('[data-subcategory-trigger]');
  const subtypeSelected = document.getElementById('subcategory-selected');
  const subtypePopover = document.querySelector('[data-subcategory-options]');
  const counter = document.querySelector('[data-count]');
  const shown = document.querySelector('[data-shown]');
  const more = document.querySelector('[data-more]');
  const pills = [...document.querySelectorAll('[data-area]')];
  const removeDiacritics = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const PAGE_SIZE = 36;
  let visibleCount = PAGE_SIZE;
  let active = 'Todos';
  let activeCategory = 'Todos';
  const make = (tag, cls, txt) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined) el.textContent = txt;
    return el;
  };
  function updateSubtypes() {
    if (!subtype) return;
    const options = [...new Set(catalog.filter(item => active === 'Todos' || item.area === active).map(item => item.categoria))]
      .sort((a,b) => a.localeCompare(b, 'pt-BR'));
    subtype.replaceChildren();
    const all = make('option', '', 'Todos os tipos');
    all.value = 'Todos';
    subtype.append(all);
    for (const name of options) {
      const option = make('option', '', name);
      option.value = name;
      subtype.append(option);
    }
    if (!options.includes(activeCategory)) activeCategory = 'Todos';
    subtype.value = activeCategory;
    subtype.disabled = options.length === 0;
    renderSubtypeDropdown();
  }

  // Progressive enhancement: keep the real native select as a non-JS fallback,
  // and display a custom listbox only when JavaScript has populated its options.
  let subtypeOpen = false;
  const dropdownReady = Boolean(subtype && subtypeControl && subtypeTrigger && subtypePopover && subtypeSelected);
  function closeSubtypeDropdown(focusTrigger = false) {
    if (!dropdownReady) return;
    subtypeOpen = false;
    subtypePopover.hidden = true;
    subtypeTrigger.setAttribute('aria-expanded', 'false');
    subtypeControl.classList.remove('is-open');
    if (focusTrigger) subtypeTrigger.focus();
  }
  function optionsInPopover() {
    return subtypePopover ? [...subtypePopover.querySelectorAll('[role="option"]')] : [];
  }
  function focusSubtypeOption(index) {
    const nodes = optionsInPopover();
    if (!nodes.length) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  }
  function openSubtypeDropdown(move = 0) {
    if (!dropdownReady || subtype.disabled) return;
    subtypeOpen = true;
    subtypePopover.hidden = false;
    subtypeTrigger.setAttribute('aria-expanded', 'true');
    subtypeControl.classList.add('is-open');
    const nodes = optionsInPopover();
    const selectedIndex = nodes.findIndex(node => node.getAttribute('aria-selected') === 'true');
    focusSubtypeOption(Math.max(0, selectedIndex) + move);
  }
  function renderSubtypeDropdown() {
    if (!dropdownReady || !subtypeControl.dataset.enhanced) return;
    closeSubtypeDropdown();
    subtypeSelected.textContent = subtype.selectedOptions[0]?.textContent || 'Todos os tipos';
    subtypePopover.replaceChildren();
    const scope = catalog.filter(item => active === 'Todos' || item.area === active);
    const counts = new Map();
    for (const item of scope) counts.set(item.categoria, (counts.get(item.categoria) || 0) + 1);
    [...subtype.options].forEach((entry, index) => {
      const option = make('button', 'subcategory-option');
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.id = 'subcategory-choice-' + index;
      option.tabIndex = -1;
      option.dataset.value = entry.value;
      option.setAttribute('aria-selected', String(entry.value === subtype.value));
      const text = make('span', 'subcategory-option-label', entry.textContent);
      const right = make('span', 'subcategory-option-meta');
      const count = make('span', 'subcategory-option-count', String(entry.value === 'Todos' ? scope.length : counts.get(entry.value) || 0));
      count.setAttribute('aria-label', 'produtos');
      const check = make('span', 'subcategory-option-check', '✓');
      check.setAttribute('aria-hidden', 'true');
      right.append(count, check);
      option.append(text, right);
      option.addEventListener('click', () => {
        subtype.value = entry.value;
        subtype.dispatchEvent(new Event('change', { bubbles: true }));
        closeSubtypeDropdown(true);
      });
      subtypePopover.append(option);
    });
  }
  if (dropdownReady) {
    subtypeControl.dataset.enhanced = 'true';
    document.getElementById('subcategory-label').htmlFor = 'subcategory-trigger';
    subtype.setAttribute('aria-hidden', 'true');
    subtype.tabIndex = -1;
    subtypeTrigger.hidden = false;
    subtypeTrigger.addEventListener('click', () => {
      if (subtypeOpen) closeSubtypeDropdown(true);
      else openSubtypeDropdown();
    });
    subtypeTrigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openSubtypeDropdown(event.key === 'ArrowDown' ? 0 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        openSubtypeDropdown(0);
        focusSubtypeOption(event.key === 'Home' ? 0 : optionsInPopover().length - 1);
      } else if (event.key === 'Escape') closeSubtypeDropdown();
    });
    subtypePopover.addEventListener('keydown', event => {
      const nodes = optionsInPopover();
      const index = nodes.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusSubtypeOption(index + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusSubtypeOption(event.key === 'Home' ? 0 : nodes.length - 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeSubtypeDropdown(true);
      } else if (event.key === 'Tab') { event.preventDefault(); closeSubtypeDropdown(true); if (!event.shiftKey) search?.focus(); }
      else if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) { const match=nodes.findIndex((n,i)=>i>index && n.textContent.trim().toLocaleLowerCase('pt-BR').startsWith(event.key.toLocaleLowerCase('pt-BR'))); const fallback=nodes.findIndex(n=>n.textContent.trim().toLocaleLowerCase('pt-BR').startsWith(event.key.toLocaleLowerCase('pt-BR'))); if (match>=0||fallback>=0) {event.preventDefault();focusSubtypeOption(match>=0?match:fallback);} }
    });
    document.addEventListener('pointerdown', event => {
      if (subtypeOpen && !subtypeControl.contains(event.target)) closeSubtypeDropdown();
    });
    document.addEventListener('keydown', event => {
      if (subtypeOpen && event.key === 'Escape') closeSubtypeDropdown(true);
    });
  }
  // Na visão geral, distribui itens entre as subcategorias para o visitante
  // conhecer a variedade da doceria sem precisar rolar dezenas de bolos.
  function distributeCategories(items) {
    const queues = new Map();
    for (const item of items) {
      const key = item.area + '|' + item.categoria;
      if (!queues.has(key)) queues.set(key, []);
      queues.get(key).push(item);
    }
    const out = [];
    for (let i=0;out.length<items.length;i++) {
      for (const queue of queues.values()) if (queue[i]) out.push(queue[i]);
    }
    return out;
  }
  function drawCatalog() {
    if (!results) return;
    const query = removeDiacritics(search ? search.value.trim() : '');
    const filtered = catalog.filter(item =>
      (active === 'Todos' || item.area === active) &&
      (activeCategory === 'Todos' || item.categoria === activeCategory) &&
      (!query || removeDiacritics(item.nome + ' ' + item.categoria + ' ' + item.area).includes(query)));
    const ordered = activeCategory === 'Todos' && !query ? distributeCategories(filtered) : filtered;
    const visible = ordered.slice(0, visibleCount);
    results.replaceChildren();
    if (counter) counter.textContent = filtered.length + (filtered.length === 1 ? ' item encontrado' : ' itens encontrados');
    if (shown) shown.textContent = visible.length + ' de ' + filtered.length + ' produtos exibidos';
    if (more) more.hidden = visible.length >= filtered.length;
    if (!catalog.length) { results.append(make('p','catalog-empty','Não foi possível carregar o catálogo. Consulte os produtos pelos telefones das unidades.')); return; }
    if (!filtered.length) {
      results.append(make('p', 'catalog-empty', 'Nenhum item encontrado. Experimente outro termo ou categoria.'));
      return;
    }
    const groups = new Map();
    visible.forEach(item => {
      const key = item.area + ' / ' + item.categoria;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const frag = document.createDocumentFragment();
    for (const [heading, items] of groups) {
      const section = make('section', 'catalog-group');
      const title = make('h4', '', heading.split(' / ')[1]);
      title.append(make('span', 'group-count', String(items.length)));
      const list = make('ul');
      items.forEach(item => {
        const li = make('li');
        const button = make('button', 'catalog-item-button', item.nome);
        button.type = 'button';
        button.setAttribute('aria-label', 'Ver informações sobre ' + item.nome);
        const key = item.area + '|' + item.categoria + '|' + item.nome;
        if (productDetails[key]) button.classList.add('has-description');
        button.addEventListener('click', () => openProduct(item, button));
        li.append(button);
        list.append(li);
      });
      section.append(title, list);
      frag.append(section);
    }
    results.append(frag);
  }
  function selectArea(area) {
    active = area;
    activeCategory = 'Todos';
    visibleCount = PAGE_SIZE;
    pills.forEach(btn => {
      const selected = btn.dataset.area === active;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
    if (search) search.value = '';
    updateSubtypes();
    drawCatalog();
  }
  pills.forEach(btn => btn.addEventListener('click', () => selectArea(btn.dataset.area)));
  document.querySelectorAll('[data-show-area]').forEach(btn => btn.addEventListener('click', () => {
    selectArea(btn.dataset.showArea);
    document.querySelector('#catalogo')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }));
  subtype?.addEventListener('change', () => {
    activeCategory = subtype.value;
    visibleCount = PAGE_SIZE;
    drawCatalog();
    renderSubtypeDropdown();
  });
  if (search) search.addEventListener('input', () => {
    visibleCount = PAGE_SIZE;
    drawCatalog();
  });
  more?.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    drawCatalog();
  });
  updateSubtypes();
  drawCatalog();
  const requested = new URLSearchParams(location.search).get('produto');
  if (requested && requested.length <= 300) {
    const chosen = catalog.find(item => [item.area,item.categoria,item.nome].join('|') === requested);
    if (chosen) {
      selectArea(chosen.area);
      if (search) search.value = chosen.nome;
      drawCatalog();
      openProduct(chosen);
    }
  }

  // Exibe apenas o cardápio atualizado.
  const menuStatus = document.getElementById('cardapio-status');
  const menuContent = document.getElementById('cardapio-conteudo');
  function emptyMenu(reason = 'A programação para as próximas datas ainda não está disponível.') {
    if (!menuContent) return;
    menuContent.replaceChildren();
    const block = make('div', 'menu-empty');
    block.append(make('strong', '', 'Almoço da Dona Flor'),
      make('p', '', 'Quer saber o que será servido hoje? Entre em contato com a unidade para conhecer os pratos disponíveis.'));
    menuContent.append(block);
    if (menuStatus) menuStatus.textContent = reason;
  }
  function localDateISO() { return MenuCore.today(); }
  function parseISODate(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y,m,d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m-1 && date.getDate() === d ? date : null;
  }
  function fmtDate(date) {
    return new Intl.DateTimeFormat('pt-BR', { weekday:'long' }).format(date);
  }
  function showMenu(data) {
    const report = MenuCore.validate(data);
    if (report.errors.length) throw new Error(report.errors.join(' | '));
    const current = localDateISO();
    const days = data.dias.filter(day =>
      parseISODate(day.data) && day.data >= current && day.data <= new Date(Date.parse(current+'T12:00Z')+6*86400000).toISOString().slice(0,10) &&
      ((Array.isArray(day.pratos) && day.pratos.length > 0) ||
       (typeof day.aviso === 'string' && day.aviso.trim()))
    ).sort((a,b) => a.data.localeCompare(b.data)).slice(0,7);
    if (!days.length) return emptyMenu();
    menuContent.replaceChildren();
    for (const day of days) {
      const article = make('article', 'menu-day');
      const heading = make('h4', '', day.titulo || fmtDate(parseISODate(day.data)));
      const tag = make('time', '', new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'2-digit'}).format(parseISODate(day.data)));
      tag.dateTime = day.data;
      heading.append(tag);
      const notice = typeof day.aviso === 'string' ? day.aviso.trim() : '';
      if (notice) {
        article.classList.add('menu-day-notice');
        article.append(heading, make('p', 'menu-day-message', notice));
      }
      const ul = make('ul');
      for (const dish of Array.isArray(day.pratos) ? day.pratos : []) {
        if (!dish || typeof dish.nome !== 'string' || !dish.nome.trim()) continue;
        const li = make('li', '', dish.nome.trim());
        // Prices are displayed only if explicitly supplied and validated as numeric.
        if (typeof dish.preco === 'number' && Number.isFinite(dish.preco) && dish.preco > 0) {
          li.append(make('span', 'dish-price', new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(dish.preco)));
        } else li.append(make('span', 'dish-price', 'Consulte o preço'));
        ul.append(li);
      }
      if (ul.childElementCount) {
        if (!notice) article.append(heading);
        article.append(ul);
      }
      if (notice || ul.childElementCount) menuContent.append(article);
    }
    if (!menuContent.childElementCount) return emptyMenu();
    if (menuStatus) {
      const observed = new Intl.DateTimeFormat('pt-BR').format(parseISODate(data.atualizado_em));
      menuStatus.textContent = `Atualizado em ${observed} · sujeito a alterações`;
    }
  }
  let lastDate = localDateISO(), loading = false;
  async function refreshMenu() {
    if (loading || !menuContent) return;
    loading = true;
    try {
      let data;
      if (location.protocol === 'file:') data = window.DONA_FLOR_OFFLINE;
      else {
        const r = await fetch('cardapio.json', {cache:'no-store', signal:AbortSignal.timeout(10000)});
        if (!r.ok) throw new Error('HTTP '+r.status+' em cardapio.json');
        data = await r.json();
      }
      showMenu(data);
      if(location.protocol === 'file:') menuStatus.textContent += ' · Cópia offline gerada; confirme a versão atual com a unidade.';
      lastDate = localDateISO();
    } catch(error) {
      console.error('[DONA-FLOR MENU_LOAD_FAILED]', {resource:'cardapio.json',message:error.message});
      emptyMenu('Não foi possível carregar a programação. Consulte a unidade para confirmar o almoço.');
    } finally { loading = false; }
  }
  refreshMenu();
  setInterval(()=>{ if(!document.hidden) refreshMenu(); },60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMenu();});
  window.addEventListener('focus',()=>{if(lastDate!==localDateISO())refreshMenu();});
})();
