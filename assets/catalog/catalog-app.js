/* ======================================================
   SARTEC — Catálogo interativo de produtos
   Navegação categoria → subcategoria → item, busca, gavetas
   de personalização/manual, sugestões relacionadas, listas
   rápidas e "Minha lista". Módulo de entrada da página
   produtos.html — carregado como <script type="module">.
   ====================================================== */

import { CATALOG_CATEGORIES, getCategoryById, searchCatalog, getRelatedItems, getQuickLists } from './data/catalog-data.js';
import { getList, subscribe, quickAddItem, updateItem, removeItem } from './catalog-list.js';
import { openPersonalizeDrawer, openManualItemDrawer } from './catalog-item-drawer.js';
import { openDrawer, closeDrawer } from './catalog-drawer.js';
import { initListUI, openListDrawer } from './catalog-list-drawer.js';
import { showToast } from './catalog-toast.js';
import { esc, debounce, variantBgClass } from './catalog-utils.js';

const CATEGORY_ICONS = {
  'cadernos-agendas-fichario': '📓',
  'canetas-lapis-marcadores': '✏️',
  'papeis-eva-materiais': '📄',
  'colas-fitas-adesivos-correcao': '🧴',
  'arte-pintura-artesanato': '🎨',
  'acessorios-escolares-geometria': '📐',
  'organizacao-escritorio': '🗂️',
  'mochilas-estojos-lancheiras': '🎒',
  'livros-atividades': '📚',
  'presentes-festas-embalagens': '🎁',
  'tecnologia-impressao-eletronicos': '🖨️',
  'brinquedos-recreacao': '🧸',
  'doces-conveniencia': '🍬',
  'utilidades-limpeza': '🧹',
};

// Piloto de 6 imagens (seção 20.1 do briefing). Formato PNG com transparência:
// não há conversor WebP disponível neste ambiente (ver relatório final).
const PILOT_IMAGE_MAP = {
  caderno_universitario_1_materia: 'assets/catalog/images/caderno_universitario.png',
  caderno_universitario_10_materias: 'assets/catalog/images/caderno_universitario.png',
  caderno_universitario_outras_materias: 'assets/catalog/images/caderno_universitario.png',
  caneta_esferografica: 'assets/catalog/images/caneta_esferografica.png',
  cola_bastao: 'assets/catalog/images/cola_bastao.png',
  papel_sulfite: 'assets/catalog/images/papel_sulfite.png',
  tinta_guache: 'assets/catalog/images/tinta_guache.png',
  mochila_escolar: 'assets/catalog/images/mochila_escolar.png',
};

let state = { type: 'home' };
let lastAddedItemId = null;

function q(id) {
  return document.getElementById(id);
}

function getListQuantityForItem(itemId) {
  return getList()
    .filter((it) => it.catalogItemId === itemId)
    .reduce((acc, it) => acc + it.quantity, 0);
}

// ---- Cards ----

function cardMediaHtml(item) {
  const bgClass = variantBgClass(item.visualVariant);
  const src = PILOT_IMAGE_MAP[item.id];
  if (src) {
    return `<div class="cat-card-media ${bgClass}">
      <img src="${esc(src)}" alt="${esc(item.name)}" width="256" height="256" loading="lazy"
        onerror="this.parentElement.classList.add('cat-card-media-placeholder'); this.remove();" />
    </div>`;
  }
  return `<div class="cat-card-media ${bgClass} cat-card-media-placeholder"></div>`;
}

function renderItemCard(item, category, subcategory, opts = {}) {
  const qty = getListQuantityForItem(item.id);
  return `
  <article class="cat-card${qty > 0 ? ' cat-card-added' : ''}" data-item-id="${esc(item.id)}" data-category-id="${esc(category.id)}" data-subcategory-id="${esc(subcategory.id)}">
    ${cardMediaHtml(item)}
    <span class="cat-card-qty-badge" ${qty > 0 ? '' : 'hidden'}>${qty}</span>
    <div class="cat-card-body">
      ${opts.showContextBadge ? `<span class="cat-card-context-badge">${esc(category.name)} · ${esc(subcategory.name)}</span>` : ''}
      <button type="button" class="cat-card-name-btn" data-action="options">
        <strong>${esc(item.name)}</strong>
        ${item.shortDescription ? `<span class="cat-card-desc">${esc(item.shortDescription)}</span>` : ''}
      </button>
    </div>
    <div class="cat-card-footer">
      <button type="button" class="cat-card-add" data-action="quick-add">${qty > 0 ? 'Adicionar mais' : 'Adicionar'}</button>
      <button type="button" class="cat-card-options-btn" data-action="options">Ver opções</button>
    </div>
  </article>`;
}

function updateCardBadges() {
  document.querySelectorAll('.cat-card').forEach((card) => {
    const id = card.dataset.itemId;
    const qty = getListQuantityForItem(id);
    const badge = card.querySelector('.cat-card-qty-badge');
    if (badge) {
      badge.hidden = qty === 0;
      badge.textContent = String(qty);
    }
    card.classList.toggle('cat-card-added', qty > 0);
    const addBtn = card.querySelector('[data-action="quick-add"]');
    if (addBtn) addBtn.textContent = qty > 0 ? 'Adicionar mais' : 'Adicionar';
  });
}

// ---- Sugestões relacionadas ----

function renderSuggestions() {
  const panel = q('cat-suggestions');
  if (!panel) return;

  if (!lastAddedItemId) {
    panel.innerHTML = '';
    panel.hidden = true;
    return;
  }

  const ctx = findItemContext(lastAddedItemId);
  if (!ctx) {
    panel.hidden = true;
    return;
  }

  const currentIds = new Set(getList().map((it) => it.catalogItemId).filter(Boolean));
  const related = getRelatedItems(ctx.item, currentIds, 4);
  if (related.length === 0) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panel.innerHTML = `
    <div class="cat-suggestions-inner">
      <p class="cat-suggestions-title">Talvez você também precise</p>
      <div class="cat-suggestions-grid">
        ${related
          .map(
            (relItem) => `
            <div class="cat-suggestion-chip" data-item-id="${esc(relItem.id)}">
              <span>${esc(relItem.name)}</span>
              <button type="button" class="cat-suggestion-add" data-related-add="${esc(relItem.id)}" data-source-item="${esc(lastAddedItemId)}">+ Adicionar</button>
            </div>`,
          )
          .join('')}
      </div>
    </div>
  `;

  window.trackEvent?.('related_item_view', { related_source_item_id: lastAddedItemId, item_id: related.map((r) => r.id).join(',') });

  panel.querySelectorAll('[data-related-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.relatedAdd;
      const item = findItemById(id);
      if (!item) return;
      quickAddItem({ catalogItemId: item.id, name: item.name });
      window.trackEvent?.('related_item_add', { item_id: id, related_source_item_id: btn.dataset.sourceItem });
      lastAddedItemId = id;
      showToast(`${item.name} adicionado à lista.`);
      renderSuggestions();
    });
  });
}

function findItemById(id) {
  for (const c of CATALOG_CATEGORIES) {
    for (const s of c.subcategories) {
      const found = s.items.find((it) => it.id === id);
      if (found) return found;
    }
  }
  return null;
}

function findItemContext(id) {
  for (const c of CATALOG_CATEGORIES) {
    for (const s of c.subcategories) {
      const found = s.items.find((it) => it.id === id);
      if (found) return { item: found, category: c, subcategory: s };
    }
  }
  return null;
}

// ---- Ações de card (delegação de evento) ----

function handleQuickAdd(itemId) {
  const ctx = findItemContext(itemId);
  if (!ctx) return;
  const { item, category, subcategory } = ctx;
  const { instanceId, mergedIntoExisting } = quickAddItem({ catalogItemId: item.id, name: item.name });
  lastAddedItemId = item.id;

  window.trackEvent?.('item_quick_add', {
    item_id: item.id,
    category_id: category.id,
    subcategory_id: subcategory.id,
    source: state.type,
  });

  showToast(`${item.name} adicionado à lista.`, {
    actionLabel: 'Desfazer',
    onAction: () => {
      const current = getList().find((it) => it.instanceId === instanceId);
      if (!current) return;
      if (mergedIntoExisting && current.quantity > 1) {
        updateItem(instanceId, { quantity: current.quantity - 1 });
      } else {
        removeItem(instanceId);
      }
      updateCardBadges();
      renderSuggestions();
    },
  });

  updateCardBadges();
  renderSuggestions();
}

function bindCardEvents(container) {
  container.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-action="quick-add"]');
    if (addBtn) {
      const card = addBtn.closest('.cat-card');
      handleQuickAdd(card.dataset.itemId);
      return;
    }
    const optionsBtn = e.target.closest('[data-action="options"]');
    if (optionsBtn) {
      const card = optionsBtn.closest('.cat-card');
      const ctx = findItemContext(card.dataset.itemId);
      if (!ctx) return;
      window.trackEvent?.('item_view', { item_id: ctx.item.id, category_id: ctx.category.id, subcategory_id: ctx.subcategory.id });
      openPersonalizeDrawer(ctx.item, {
        categoryId: ctx.category.id,
        subcategoryId: ctx.subcategory.id,
        source: state.type,
        onAdded: () => {
          lastAddedItemId = ctx.item.id;
          updateCardBadges();
          renderSuggestions();
        },
      });
    }
  });
}

// ---- Views ----

function setBreadcrumb() {
  const el = q('cat-breadcrumb');
  if (!el) return;
  const partes = [`<button type="button" class="cat-crumb" data-crumb="home">Produtos</button>`];
  if (state.type === 'category' || state.type === 'subcategory') {
    const category = getCategoryById(state.categoryId);
    if (category) partes.push(`<button type="button" class="cat-crumb" data-crumb="category" data-id="${esc(category.id)}">${esc(category.name)}</button>`);
  }
  if (state.type === 'subcategory') {
    const category = getCategoryById(state.categoryId);
    const sub = category?.subcategories.find((s) => s.id === state.subcategoryId);
    if (sub) partes.push(`<span class="cat-crumb cat-crumb-current">${esc(sub.name)}</span>`);
  }
  if (state.type === 'search') {
    partes.push(`<span class="cat-crumb cat-crumb-current">Busca: "${esc(state.query)}"</span>`);
  }
  el.innerHTML = partes.join('<span class="cat-crumb-sep" aria-hidden="true">›</span>');
  el.querySelectorAll('[data-crumb="home"]').forEach((b) => b.addEventListener('click', () => navigate({ type: 'home' })));
  el.querySelectorAll('[data-crumb="category"]').forEach((b) => b.addEventListener('click', () => navigate({ type: 'category', categoryId: b.dataset.id })));
}

function renderHome(container) {
  const featured = CATALOG_CATEGORIES.filter((c) => c.featured);
  const others = CATALOG_CATEGORIES.filter((c) => !c.featured);

  container.innerHTML = `
    <div class="cat-category-grid cat-category-grid-featured">
      ${featured.map(categoryTileHtml).join('')}
    </div>
    <h2 class="cat-section-title">Mais categorias</h2>
    <div class="cat-category-grid cat-category-grid-secondary">
      ${others.map(categoryTileHtml).join('')}
    </div>
  `;

  container.querySelectorAll('[data-category-tile]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.categoryTile;
      window.trackEvent?.('category_open', { category_id: id, source: 'home' });
      navigate({ type: 'category', categoryId: id });
    });
  });
}

function categoryTileHtml(category) {
  const icon = CATEGORY_ICONS[category.id] || '🛍️';
  const itemCount = category.subcategories.reduce((acc, s) => acc + s.items.length, 0);
  return `
    <button type="button" class="cat-category-tile" data-category-tile="${esc(category.id)}">
      <span class="cat-category-tile-icon" aria-hidden="true">${icon}</span>
      <strong>${esc(category.name)}</strong>
      <span class="cat-category-tile-desc">${esc(category.description)}</span>
      <span class="cat-category-tile-count">${itemCount} tipos de produto</span>
    </button>
  `;
}

function renderCategory(container, categoryId) {
  const category = getCategoryById(categoryId);
  if (!category) {
    container.innerHTML = `<p class="cat-empty-state">Categoria não encontrada. <button type="button" class="cat-link-btn" id="cat-back-home">Voltar para produtos</button></p>`;
    container.querySelector('#cat-back-home')?.addEventListener('click', () => navigate({ type: 'home' }));
    return;
  }

  const subcats = [...category.subcategories].sort((a, b) => a.order - b.order);
  container.innerHTML = `
    <h1 class="cat-page-title">${esc(category.name)}</h1>
    <p class="cat-page-desc">${esc(category.description)}</p>
    <div class="cat-subcategory-grid">
      ${subcats
        .map(
          (sub) => `
        <button type="button" class="cat-subcategory-tile" data-subcategory-tile="${esc(sub.id)}">
          <strong>${esc(sub.name)}</strong>
          <span>${sub.items.length} ${sub.items.length === 1 ? 'tipo de produto' : 'tipos de produto'}</span>
        </button>
      `,
        )
        .join('')}
    </div>
  `;

  container.querySelectorAll('[data-subcategory-tile]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.subcategoryTile;
      window.trackEvent?.('subcategory_open', { category_id: category.id, subcategory_id: id });
      navigate({ type: 'subcategory', categoryId: category.id, subcategoryId: id });
    });
  });
}

function renderSubcategory(container, categoryId, subcategoryId) {
  const category = getCategoryById(categoryId);
  const sub = category?.subcategories.find((s) => s.id === subcategoryId);
  if (!category || !sub) {
    container.innerHTML = `<p class="cat-empty-state">Subcategoria não encontrada. <button type="button" class="cat-link-btn" id="cat-back-home">Voltar para produtos</button></p>`;
    container.querySelector('#cat-back-home')?.addEventListener('click', () => navigate({ type: 'home' }));
    return;
  }

  container.innerHTML = `
    <h1 class="cat-page-title">${esc(sub.name)}</h1>
    ${sub.description ? `<p class="cat-page-desc">${esc(sub.description)}</p>` : ''}
    <div class="cat-item-grid">
      ${sub.items.map((item) => renderItemCard(item, category, sub)).join('')}
    </div>
  `;
}

function renderSearchResults(container, query) {
  const { results, synonymTermUsed } = searchCatalog(query);

  window.trackEvent?.('catalog_search', { search_term: query });

  if (results.length === 0) {
    window.trackEvent?.('catalog_search_no_result', { search_term: query });
    container.innerHTML = `
      <div class="cat-empty-state cat-search-empty">
        <p>Não encontramos esse produto nas categorias. Deseja adicionar “${esc(query)}” manualmente?</p>
        <button type="button" class="cat-drawer-btn-primary" id="cat-search-add-manual">Adicionar “${esc(query)}” manualmente</button>
      </div>
    `;
    container.querySelector('#cat-search-add-manual')?.addEventListener('click', () => {
      openManualItemDrawer({ prefillName: query, source: 'search_no_result' });
    });
    return;
  }

  container.innerHTML = `
    <p class="cat-search-results-count">${results.length} ${results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}${synonymTermUsed ? ' · sugestão por sinônimo' : ''}</p>
    <div class="cat-item-grid">
      ${results.map(({ item, category, subcategory }) => renderItemCard(item, category, subcategory, { showContextBadge: true })).join('')}
    </div>
  `;
}

function renderView(opts = {}) {
  const container = q('cat-view');
  if (!container) return;

  setBreadcrumb();

  if (state.type === 'home') {
    renderHome(container);
    renderQuickLists();
    q('cat-quicklists-wrap') && (q('cat-quicklists-wrap').hidden = false);
  } else {
    q('cat-quicklists-wrap') && (q('cat-quicklists-wrap').hidden = true);
    if (state.type === 'category') renderCategory(container, state.categoryId);
    else if (state.type === 'subcategory') renderSubcategory(container, state.categoryId, state.subcategoryId);
    else if (state.type === 'search') renderSearchResults(container, state.query);
  }

  if (opts.scroll) {
    container.scrollIntoView?.({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
}

function navigate(next, opts = {}) {
  state = next;
  const searchInput = q('cat-search-input');
  if (state.type !== 'search' && searchInput) searchInput.value = '';
  renderView({ scroll: opts.scroll !== false });
}

// ---- Busca ----

function initSearch() {
  const form = q('cat-search-form');
  const input = q('cat-search-input');
  if (!form || !input) return;

  const runSearch = debounce((value) => {
    const termo = value.trim();
    if (!termo) {
      if (state.type === 'search') navigate({ type: 'home' });
      return;
    }
    navigate({ type: 'search', query: termo });
  }, 260);

  input.addEventListener('input', () => runSearch(input.value));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const termo = input.value.trim();
    if (termo) navigate({ type: 'search', query: termo });
  });
}

// ---- Listas rápidas ----

function renderQuickLists() {
  const wrap = q('cat-quicklists');
  if (!wrap) return;
  const lists = getQuickLists();
  if (lists.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = `
    <h2 class="cat-section-title">Listas rápidas</h2>
    <div class="cat-quicklist-row">
      ${lists
        .map(
          (ql) => `
        <button type="button" class="cat-quicklist-chip" data-quicklist="${esc(ql.id)}">
          <span aria-hidden="true">${ql.icon}</span> ${esc(ql.label)}
        </button>
      `,
        )
        .join('')}
    </div>
  `;
  wrap.querySelectorAll('[data-quicklist]').forEach((btn) => {
    btn.addEventListener('click', () => openQuickListDrawer(btn.dataset.quicklist));
  });
}

function openQuickListDrawer(quickListId) {
  const list = getQuickLists().find((ql) => ql.id === quickListId);
  if (!list) return;

  window.trackEvent?.('quick_list_open', { quick_list_id: quickListId });

  openDrawer({
    id: 'quicklist-' + quickListId,
    title: list.label,
    render(body) {
      body.innerHTML = `
        <p class="cat-drawer-desc">Marque os itens que você quer adicionar à sua lista.</p>
        <div class="cat-quicklist-options">
          ${list.items
            .map(
              (item) => `
            <label class="cat-quicklist-option">
              <input type="checkbox" value="${esc(item.id)}" checked />
              <span>${esc(item.name)}</span>
            </label>
          `,
            )
            .join('')}
        </div>
        <div class="cat-drawer-actions">
          <button type="button" class="cat-drawer-btn-secondary" id="cat-quicklist-cancel">Cancelar</button>
          <button type="button" class="cat-drawer-btn-primary" id="cat-quicklist-confirm">Adicionar selecionados</button>
        </div>
      `;
      body.querySelector('#cat-quicklist-cancel').addEventListener('click', () => closeDrawer());
      body.querySelector('#cat-quicklist-confirm').addEventListener('click', () => {
        const checked = Array.from(body.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
        checked.forEach((id) => {
          const item = findItemById(id);
          if (item) quickAddItem({ catalogItemId: item.id, name: item.name });
        });
        window.trackEvent?.('quick_list_add', { quick_list_id: quickListId, item_count: checked.length });
        closeDrawer();
        if (checked.length > 0) {
          lastAddedItemId = checked[checked.length - 1];
          showToast(`${checked.length} ${checked.length === 1 ? 'item adicionado' : 'itens adicionados'} à lista.`);
          updateCardBadges();
          renderSuggestions();
        }
      });
    },
  });
}

// ---- Inicialização ----

export function initCatalog() {
  initSearch();
  initListUI();

  const view = q('cat-view');
  if (view) bindCardEvents(view);

  q('cat-add-manual-btn')?.addEventListener('click', () => openManualItemDrawer({ source: 'manual_button' }));

  subscribe(() => {
    updateCardBadges();
  });

  navigate({ type: 'home' }, { scroll: false });
  window.trackEvent?.('catalog_view', { viewport_type: window.innerWidth < 768 ? 'mobile' : 'desktop' });
}

document.addEventListener('DOMContentLoaded', initCatalog);
