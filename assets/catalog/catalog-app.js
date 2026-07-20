/* ======================================================
   SARTEC — Catálogo interativo de produtos
   Vitrine contínua: categoria → todos os produtos da hora,
   subcategoria funciona só como filtro da mesma grade.
   Estado sincronizado com a URL (?categoria=&subcategoria=
   ou ?q=), histórico do navegador e posição de scroll
   preservados. Busca com sinônimos e tolerância a erros,
   gavetas de personalização/manual, sugestões relacionadas,
   listas rápidas, vistos recentemente e "Minha lista".
   Módulo de entrada da página produtos.html — carregado
   como <script type="module">.
   ====================================================== */

import {
  CATALOG_CATEGORIES,
  getCategoryById,
  getItemById,
  getItemContext,
  getCategoryItemCount,
  getSubcategoryCounts,
  searchCatalog,
  getRelatedItems,
  getQuickLists,
} from './data/catalog-data.js';
import { getRelatedCategoryIds } from './data/relatedCategories.js';
import { getList, subscribe, quickAddItem, updateItem, removeItem } from './catalog-list.js';
import { registerRecentlyViewed, getRecentlyViewed } from './recently-viewed.js';
import { openPersonalizeDrawer, openManualItemDrawer } from './catalog-item-drawer.js';
import { openDrawer, closeDrawer } from './catalog-drawer.js';
import { initListUI, openListDrawer } from './catalog-list-drawer.js';
import { showToast } from './catalog-toast.js';
import { esc, debounce, variantBgClass } from './catalog-utils.js';
import { celebrateAdd } from './catalog-add-animation.js';

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
};

// Ícone da "Minha lista" em todo o catálogo — nunca um carrinho de compras,
// já que a página monta uma lista para orçamento, não um checkout.
export const LIST_ICON = '📋';

// Produtos com imagem própria já gerada (ver assets/catalog/images/manifest.json).
// Usado para priorizar produtos com foto real nas fileiras horizontais da home.
const IMAGE_COVERED_IDS = new Set([
  'caderno_universitario_1_materia', 'caderno_universitario_10_materias', 'caderno_universitario_outras_materias',
  'caderno_brochura', 'caderno_brochurao', 'caderno_espiral_14', 'caderno_colegial', 'caderno_cartografia_desenho',
  'caderno_caligrafia', 'caderno_argolado', 'agenda', 'planner', 'diario', 'calendario', 'caderneta',
  'bloco_anotacoes', 'bloco_adesivo_notas', 'fichario', 'refil_fichario', 'acessorios_fichario',
  'caneta_esferografica', 'caneta_gel', 'caneta_hidrografica', 'caneta_tecnica_fineliner', 'caneta_brush_lettering',
  'caneta_especial', 'lapis_grafite', 'lapis_de_cor', 'lapiseira', 'grafite_lapiseira', 'marca_texto',
  'marcador_quadro_branco', 'marcador_permanente', 'marcador_brush_lettering', 'marcador_especial',
  'refil_marcador_quadro_branco', 'refil_marcador_permanente', 'giz_de_cera', 'giz_para_quadro',
  'papel_sulfite', 'cartolina', 'papel_cartao', 'papel_crepom', 'papel_para_dobradura', 'papel_seda',
  'papel_celofane', 'papel_carbono', 'papel_kraft', 'papel_vegetal', 'papel_fotografico', 'papel_couche',
  'papel_adesivo', 'papel_colorido_criativo', 'bloco_de_desenho', 'bloco_trabalhos_escolares', 'eva_liso',
  'eva_com_glitter', 'eva_atoalhado', 'eva_estampado', 'isopor', 'plastico_adesivo_contact',
  'plastico_para_encapar', 'plastico_para_plastificar', 'folhas_capas_plasticas', 'tnt', 'feltro',
  'cola_bastao', 'cola_branca', 'cola_instantanea', 'cola_quente', 'cola_de_silicone', 'cola_para_eva_isopor',
  'cola_para_madeira', 'cola_para_tecido', 'cola_para_artesanato', 'fita_adesiva_transparente',
  'fita_adesiva_colorida', 'fita_dupla_face', 'fita_crepe', 'fita_para_embalagem', 'fita_isolante',
  'etiqueta_para_impressao', 'etiqueta_de_preco', 'etiqueta_escolar', 'adesivo_decorativo', 'etiquetas_em_geral',
  'borracha', 'corretivo_em_fita', 'corretivo_liquido', 'caneta_corretiva', 'tinta_guache', 'tinta_para_tecido',
  'tinta_acrilica', 'tinta_pva_artesanato', 'tinta_dimensional_relevo', 'aquarela', 'tinta_spray',
  'tinta_metalica', 'tinta_nanquim', 'pincel_chato', 'pincel_redondo', 'pincel_artistico',
  'acessorios_para_pintura', 'lapis_artistico', 'materiais_desenho_artistico', 'stencil', 'massa_de_modelar',
  'kit_de_modelagem', 'pasta_com_elastico', 'mochila_escolar', 'estojo_triplo', 'mouse_sem_fio',
]);

// Convenção: toda imagem de produto gerada pelo MCP do Magnific fica em
// assets/catalog/images/<id-do-item>.png. Não há mapa fixo — a cobertura é
// de todos os produtos ativos (ver manifest.json). Caso um arquivo falhe ao
// carregar (ausente ou corrompido), o onerror do <img> aciona o fallback
// visual e o evento catalog_image_load_error é disparado.
function getImagePath(item) {
  return `assets/catalog/images/${item.id}.png`;
}

// Quantidade máxima de produtos em cada fileira horizontal da home.
const SECTION_ITEM_LIMIT = 10;

let state = { type: 'home' };
let lastAddedItemId = null;
let currentBackAction = null;
let historyReady = false;

function q(id) {
  return document.getElementById(id);
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function getListQuantityForItem(itemId) {
  return getList()
    .filter((it) => it.catalogItemId === itemId)
    .reduce((acc, it) => acc + it.quantity, 0);
}

// ---- Fallback visual (sem imagem) ----

function lapisinhosMarkHtml() {
  return `<svg class="cat-lapisinhos-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="3" y="13" width="26" height="6" rx="2" fill="#1E3A8A" transform="rotate(-16 16 16)"/>
    <rect x="3" y="13" width="26" height="6" rx="2" fill="#DC2626" transform="rotate(16 16 16)"/>
  </svg>`;
}

function fallbackMediaHtml(item, category, bgClass) {
  const icon = CATEGORY_ICONS[category?.id] || '🛍️';
  const showMark = hashStr(item.id) % 3 === 0;
  return `<div class="cat-card-media ${bgClass} cat-card-media-placeholder">
    ${showMark ? lapisinhosMarkHtml() : ''}
    <span class="cat-fallback-icon" aria-hidden="true">${icon}</span>
    <span class="cat-fallback-name">${esc(item.name)}</span>
  </div>`;
}

// ---- Cards ----

function cardMediaHtml(item, category) {
  const bgClass = variantBgClass(item.visualVariant);
  const src = getImagePath(item);
  return `<div class="cat-card-media ${bgClass}">
    <img src="${esc(src)}" alt="${esc(item.name)}" width="256" height="256" loading="lazy"
      onerror="this.parentElement.classList.add('cat-card-media-placeholder'); this.remove(); window.trackEvent && window.trackEvent('catalog_image_load_error', { item_id: '${esc(item.id)}' });" />
  </div>`;
}

function renderItemCard(item, category, subcategory, opts = {}) {
  const qty = getListQuantityForItem(item.id);
  return `
  <article class="cat-card${qty > 0 ? ' cat-card-added' : ''}" data-item-id="${esc(item.id)}" data-category-id="${esc(category.id)}" data-subcategory-id="${esc(subcategory.id)}">
    ${cardMediaHtml(item, category)}
    <span class="cat-card-qty-badge" ${qty > 0 ? '' : 'hidden'}>${qty}</span>
    <div class="cat-card-body">
      ${opts.showContextBadge ? `
        <span class="cat-card-context-badge">${esc(category.name)} · ${esc(subcategory.name)}</span>
        <button type="button" class="cat-card-category-link" data-action="open-category" data-goto-category="${esc(category.id)}">Ver categoria</button>
      ` : ''}
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

// ---- Sugestões relacionadas ("Complete sua lista") ----

function renderSuggestions() {
  const panel = q('cat-suggestions');
  if (!panel) return;

  if (!lastAddedItemId) {
    panel.innerHTML = '';
    panel.hidden = true;
    return;
  }

  const ctx = getItemContext(lastAddedItemId);
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
      <p class="cat-suggestions-title">Complete sua lista</p>
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
}

function onSuggestionsClick(e) {
  const btn = e.target.closest('[data-related-add]');
  if (!btn) return;
  const id = btn.dataset.relatedAdd;
  const item = getItemById(id);
  if (!item) return;
  quickAddItem({ catalogItemId: item.id, name: item.name });
  window.trackEvent?.('related_item_add', { item_id: id, related_source_item_id: btn.dataset.sourceItem });
  lastAddedItemId = id;
  celebrateAdd(btn, item.name);
  showToast(`${item.name} adicionado à lista.`);
  renderSuggestions();
  updateCardBadges();
}

// ---- Fileiras horizontais reutilizáveis (home, vistos recentemente) ----

function scrollRowHtml(cardsHtml) {
  return `
    <div class="cat-row-wrap">
      <button type="button" class="cat-row-nav cat-row-nav-prev" data-row-nav="prev" aria-label="Ver produtos anteriores" hidden>‹</button>
      <div class="cat-item-grid-scroll" data-row-scroll>${cardsHtml}</div>
      <button type="button" class="cat-row-nav cat-row-nav-next" data-row-nav="next" aria-label="Ver mais produtos" hidden>›</button>
    </div>
  `;
}

function initRowScroller(el) {
  const wrap = el.closest('.cat-row-wrap');
  const prevBtn = wrap?.querySelector('[data-row-nav="prev"]');
  const nextBtn = wrap?.querySelector('[data-row-nav="next"]');

  function updateArrows() {
    const maxScroll = el.scrollWidth - el.clientWidth - 2;
    const scrollable = el.scrollWidth > el.clientWidth + 4;
    if (prevBtn) prevBtn.hidden = !scrollable || el.scrollLeft <= 4;
    if (nextBtn) nextBtn.hidden = !scrollable || el.scrollLeft >= maxScroll;
  }

  el.addEventListener('scroll', debounce(updateArrows, 60), { passive: true });
  window.addEventListener('resize', debounce(updateArrows, 150));
  updateArrows();

  prevBtn?.addEventListener('click', () => el.scrollBy({ left: -el.clientWidth * 0.85, behavior: reducedMotion() ? 'auto' : 'smooth' }));
  nextBtn?.addEventListener('click', () => el.scrollBy({ left: el.clientWidth * 0.85, behavior: reducedMotion() ? 'auto' : 'smooth' }));

  // Roda do mouse: converte scroll vertical em horizontal quando fizer sentido.
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  // Arraste com o mouse (trackpad/touch já rolam nativamente).
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    el.scrollLeft = startScroll - dx;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (moved) {
      const suppressClick = (ev) => ev.stopPropagation();
      el.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', suppressClick, { capture: true }), 0);
    }
  }
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointerleave', endDrag);
}

function initRowScrollers(container) {
  container.querySelectorAll('[data-row-scroll]').forEach(initRowScroller);
}

// ---- Vistos recentemente ----

function recentlyViewedHtml() {
  const items = getRecentlyViewed((id) => getItemContext(id)?.item || null, 8);
  if (items.length === 0) return '';
  window.trackEvent?.('catalog_recently_viewed_view', { item_count: items.length });
  const cardsHtml = items
    .map((item) => {
      const ctx = getItemContext(item.id);
      return renderItemCard(item, ctx.category, ctx.subcategory);
    })
    .join('');
  return `
    <section id="cat-recently-viewed-section" aria-labelledby="cat-recently-viewed-title">
      <h2 class="cat-section-title" id="cat-recently-viewed-title">Vistos recentemente</h2>
      ${scrollRowHtml(cardsHtml)}
    </section>
  `;
}

/** Atualiza somente o bloco "Vistos recentemente" in-place (home e categoria), sem re-renderizar o resto da view. */
function renderRecentlyViewed() {
  const slot = document.getElementById('cat-recently-viewed-slot');
  if (!slot) return;
  slot.innerHTML = recentlyViewedHtml();
  initRowScrollers(slot);
}

// ---- Ações de card (delegação de evento única em #cat-view) ----

function handleQuickAdd(itemId, sourceEl) {
  const ctx = getItemContext(itemId);
  if (!ctx) return;
  const { item, category, subcategory } = ctx;
  const { instanceId, mergedIntoExisting } = quickAddItem({ catalogItemId: item.id, name: item.name });
  lastAddedItemId = item.id;
  registerRecentlyViewed(item.id);

  window.trackEvent?.('item_quick_add', {
    item_id: item.id,
    category_id: category.id,
    subcategory_id: subcategory.id,
    source: state.type,
  });
  window.trackEvent?.('catalog_item_quick_add', { item_id: item.id, category_id: category.id, source: state.type });
  if (sourceEl?.closest('#cat-recently-viewed-section')) {
    window.trackEvent?.('catalog_recently_viewed_add', { item_id: item.id });
  }

  celebrateAdd(sourceEl, item.name);

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
  renderRecentlyViewed();
}

function handleOpenOptions(itemId) {
  const ctx = getItemContext(itemId);
  if (!ctx) return;
  registerRecentlyViewed(ctx.item.id);
  window.trackEvent?.('item_view', { item_id: ctx.item.id, category_id: ctx.category.id, subcategory_id: ctx.subcategory.id });
  window.trackEvent?.('catalog_product_view', { item_id: ctx.item.id, category_id: ctx.category.id });
  window.trackEvent?.('catalog_product_options_open', { item_id: ctx.item.id, category_id: ctx.category.id });
  openPersonalizeDrawer(ctx.item, {
    categoryId: ctx.category.id,
    subcategoryId: ctx.subcategory.id,
    source: state.type,
    onAdded: () => {
      lastAddedItemId = ctx.item.id;
      updateCardBadges();
      renderSuggestions();
      renderRecentlyViewed();
    },
  });
}

function onCatViewClick(e) {
  const addBtn = e.target.closest('[data-action="quick-add"]');
  if (addBtn) {
    const card = addBtn.closest('[data-item-id]');
    if (card) handleQuickAdd(card.dataset.itemId, addBtn);
    return;
  }
  const optionsBtn = e.target.closest('[data-action="options"]');
  if (optionsBtn) {
    const card = optionsBtn.closest('[data-item-id]');
    if (card) handleOpenOptions(card.dataset.itemId);
    return;
  }
  const gotoCategoryBtn = e.target.closest('[data-action="open-category"]');
  if (gotoCategoryBtn) {
    openCategory(gotoCategoryBtn.dataset.gotoCategory, 'search');
    return;
  }
  const combineBtn = e.target.closest('[data-combine-add]');
  if (combineBtn) {
    handleQuickAdd(combineBtn.dataset.combineAdd, combineBtn);
    return;
  }
  const categoryTile = e.target.closest('[data-category-tile]');
  if (categoryTile) {
    const source = categoryTile.dataset.tileSource || 'home';
    if (source === 'continue-explore') {
      window.trackEvent?.('catalog_continue_exploring_click', { category_id: categoryTile.dataset.categoryTile, from_category_id: state.categoryId });
    }
    openCategory(categoryTile.dataset.categoryTile, source);
    return;
  }
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn && state.type === 'category') {
    selectSubcategoryFilter(state.categoryId, filterBtn.dataset.filter || null);
    return;
  }
  const manualBtn = e.target.closest('[data-search-add-manual]');
  if (manualBtn) {
    openManualDrawerTracked('search_no_result', { prefillName: manualBtn.dataset.searchAddManual });
    return;
  }
  const openManualBtn = e.target.closest('[data-open-manual]');
  if (openManualBtn) {
    const categoryId = openManualBtn.dataset.openManualCategory;
    const category = categoryId ? getCategoryById(categoryId) : null;
    openManualDrawerTracked(
      openManualBtn.dataset.openManual,
      category ? { categoryId: category.id, categoryName: category.name } : {},
    );
    return;
  }
  const quicklistBtn = e.target.closest('[data-quicklist-open]');
  if (quicklistBtn) {
    openQuickListDrawer(quicklistBtn.dataset.quicklistOpen);
  }
}

function openManualDrawerTracked(source, opts = {}) {
  window.trackEvent?.('catalog_manual_item_open', { source });
  openManualItemDrawer({ ...opts, source });
}

// ---- Seleção determinística de produtos por fileira (home) ----

const sectionItemsCache = new Map();

/**
 * Escolhe até SECTION_ITEM_LIMIT produtos de uma categoria para a fileira
 * horizontal da home: sempre os mesmos a cada carregamento (sem sorteio),
 * priorizando produtos com imagem própria e alternando entre subcategorias
 * diferentes antes de repetir uma mesma subcategoria (evita encher a
 * fileira com pequenas variações quase idênticas do mesmo item).
 */
function pickSectionItems(category) {
  if (sectionItemsCache.has(category.id)) return sectionItemsCache.get(category.id);

  const subcats = [...category.subcategories].sort((a, b) => a.order - b.order).map((s) => ({
    sub: s,
    items: s.items.filter((it) => it.active),
  })).filter((s) => s.items.length > 0);

  const diverse = [];
  let round = 0;
  let added = true;
  while (added && diverse.length < subcats.reduce((acc, s) => acc + s.items.length, 0)) {
    added = false;
    for (const { sub, items } of subcats) {
      if (items[round]) {
        diverse.push({ item: items[round], sub });
        added = true;
      }
    }
    round++;
  }

  // Ordenação estável: produtos com imagem própria primeiro, preservando a
  // diversidade de subcategorias já obtida pelo round-robin acima.
  diverse.sort((a, b) => {
    const aHas = IMAGE_COVERED_IDS.has(a.item.id) ? 0 : 1;
    const bHas = IMAGE_COVERED_IDS.has(b.item.id) ? 0 : 1;
    return aHas - bHas;
  });

  const picked = diverse.slice(0, SECTION_ITEM_LIMIT).map(({ item, sub }) => ({ item, category, subcategory: sub }));
  sectionItemsCache.set(category.id, picked);
  return picked;
}

// ---- Categorias ----

function categoryTileHtml(category, opts = {}) {
  const icon = CATEGORY_ICONS[category.id] || '🛍️';
  const itemCount = getCategoryItemCount(category);
  return `
    <button type="button" class="cat-category-tile" data-category-tile="${esc(category.id)}" data-tile-source="${esc(opts.source || 'home')}">
      <span class="cat-category-tile-icon" aria-hidden="true">${icon}</span>
      <strong>${esc(category.name)}</strong>
      <span class="cat-category-tile-desc">${esc(category.description)}</span>
      <span class="cat-category-tile-count">${itemCount} tipos de produto</span>
    </button>
  `;
}

// Navegação única e completa de categorias, sempre visível na barra de
// ferramentas (nunca uma lista parcial) — as 11 categorias, sempre na
// mesma ordem, com o item ativo destacado quando uma categoria está aberta.
function renderCategoryNav() {
  const rail = q('cat-rail');
  if (!rail) return;
  rail.innerHTML = CATALOG_CATEGORIES.map((c) => `
    <button type="button" class="cat-rail-chip${c.id === state.categoryId ? ' cat-rail-chip-active' : ''}" data-category-tile="${esc(c.id)}" data-tile-source="nav" aria-current="${c.id === state.categoryId ? 'true' : 'false'}">
      <span aria-hidden="true">${CATEGORY_ICONS[c.id] || '🛍️'}</span> ${esc(c.name)}
    </button>
  `).join('');
}

function openAllCategoriesDrawer() {
  window.trackEvent?.('catalog_all_categories_open', { source: state.type });
  openDrawer({
    id: 'all-categories',
    title: 'Todas as categorias',
    render(body) {
      body.innerHTML = `<div class="cat-category-grid">${CATALOG_CATEGORIES.map((c) => categoryTileHtml(c, { source: 'all_categories_drawer' })).join('')}</div>`;
      body.querySelectorAll('[data-category-tile]').forEach((tile) => {
        tile.addEventListener('click', () => {
          closeDrawer();
          openCategory(tile.dataset.categoryTile, 'all_categories_drawer');
        });
      });
    },
  });
}

// ---- Views ----

function filterChipsHtml(category, activeSubcategoryId) {
  const subCounts = getSubcategoryCounts(category);
  if (subCounts.length <= 1) return '';
  const total = getCategoryItemCount(category);
  const chips = [
    `<button type="button" class="cat-filter-chip${!activeSubcategoryId ? ' cat-filter-chip-active' : ''}" data-filter="">Todos <span class="cat-filter-count">${total}</span></button>`,
    ...subCounts.map(
      (s) => `<button type="button" class="cat-filter-chip${activeSubcategoryId === s.id ? ' cat-filter-chip-active' : ''}" data-filter="${esc(s.id)}">${esc(s.name)} <span class="cat-filter-count">${s.count}</span></button>`,
    ),
  ];
  return `<div class="cat-filter-row" role="tablist" aria-label="Filtrar por subcategoria">${chips.join('')}</div>`;
}

function categoryGridHtml(category, activeSubcategoryId) {
  const subCounts = getSubcategoryCounts(category);

  if (activeSubcategoryId) {
    const sub = category.subcategories.find((s) => s.id === activeSubcategoryId);
    if (!sub) return '<p class="cat-empty-state">Filtro não encontrado.</p>';
    const items = sub.items.filter((it) => it.active);
    return `<div class="cat-item-grid">${items.map((item) => renderItemCard(item, category, sub)).join('')}</div>`;
  }

  if (subCounts.length <= 1) {
    const sub = category.subcategories.find((s) => s.items.some((it) => it.active)) || category.subcategories[0];
    const items = sub.items.filter((it) => it.active);
    return `<div class="cat-item-grid">${items.map((item) => renderItemCard(item, category, sub)).join('')}</div>`;
  }

  // "Todos" com múltiplas subcategorias — divisores internos, nada escondido.
  return subCounts
    .map((s) => {
      const sub = category.subcategories.find((c) => c.id === s.id);
      const items = sub.items.filter((it) => it.active);
      return `
        <h3 class="cat-subcategory-divider">${esc(sub.name)}</h3>
        <div class="cat-item-grid">${items.map((item) => renderItemCard(item, category, sub)).join('')}</div>
      `;
    })
    .join('');
}

function combineComHtml(category, activeSubcategoryId) {
  if (activeSubcategoryId) return '';
  const total = getCategoryItemCount(category);
  if (total <= 10) return '';
  const firstItem = category.subcategories.flatMap((s) => s.items).find((it) => it.active);
  if (!firstItem) return '';
  const currentIds = new Set(getList().map((it) => it.catalogItemId).filter(Boolean));
  const related = getRelatedItems(firstItem, currentIds, 4);
  if (related.length === 0) return '';
  return `
    <div class="cat-combine-rail">
      <p class="cat-combine-title">Combine com</p>
      <div class="cat-combine-row">
        ${related.map((it) => `<button type="button" class="cat-combine-chip" data-combine-add="${esc(it.id)}">+ ${esc(it.name)}</button>`).join('')}
      </div>
    </div>`;
}

function continueExploringHtml(category) {
  const related = getRelatedCategoryIds(category.id, 4).map(getCategoryById).filter(Boolean);
  if (related.length === 0) return '';
  window.trackEvent?.('catalog_continue_exploring_view', { category_id: category.id });
  return `
    <div class="cat-continue-explore">
      <h2 class="cat-section-title">Continue explorando</h2>
      <div class="cat-category-grid cat-category-grid-secondary">
        ${related.map((c) => categoryTileHtml(c, { source: 'continue-explore' })).join('')}
      </div>
    </div>`;
}

function categorySectionHtml(category) {
  const picked = pickSectionItems(category);
  if (picked.length === 0) return '';
  const cardsHtml = picked.map(({ item, category: c, subcategory: s }) => renderItemCard(item, c, s)).join('');
  return `
    <section class="cat-home-section" aria-labelledby="cat-home-section-${esc(category.id)}">
      <div class="cat-home-section-head">
        <h2 id="cat-home-section-${esc(category.id)}">${esc(category.name)}</h2>
        <button type="button" class="cat-see-all" data-category-tile="${esc(category.id)}" data-tile-source="home_see_all">Ver tudo</button>
      </div>
      ${scrollRowHtml(cardsHtml)}
      <p class="cat-manual-inline"><button type="button" class="cat-link-btn" data-open-manual="home_section_${esc(category.id)}" data-open-manual-category="${esc(category.id)}">Não encontrou? Adicione outro item</button></p>
    </section>
  `;
}

function renderHome(container) {
  container.innerHTML = `
    ${CATALOG_CATEGORIES.map((c) => categorySectionHtml(c)).join('')}
    ${quickListsHtml()}
    <div id="cat-recently-viewed-slot">${recentlyViewedHtml()}</div>
  `;
}

function renderCategory(container, categoryId, subcategoryId) {
  const category = getCategoryById(categoryId);
  if (!category) {
    container.innerHTML = `<p class="cat-empty-state">Categoria não encontrada. <button type="button" class="cat-link-btn" id="cat-back-home-fallback">Voltar para produtos</button></p>`;
    container.querySelector('#cat-back-home-fallback')?.addEventListener('click', () => goHome());
    return;
  }

  const validSubcategoryId = subcategoryId && category.subcategories.some((s) => s.id === subcategoryId) ? subcategoryId : null;

  container.innerHTML = `
    <h1 class="cat-page-title">${esc(category.name)}</h1>
    <p class="cat-page-desc">${esc(category.description)}</p>
    ${filterChipsHtml(category, validSubcategoryId)}
    ${categoryGridHtml(category, validSubcategoryId)}
    ${combineComHtml(category, validSubcategoryId)}
    <div id="cat-recently-viewed-slot">${recentlyViewedHtml()}</div>
    ${continueExploringHtml(category)}
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
        <button type="button" class="cat-drawer-btn-primary" data-search-add-manual="${esc(query)}">Adicionar “${esc(query)}” manualmente</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <p class="cat-search-results-count">${results.length} ${results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}${synonymTermUsed ? ' · sugestão por sinônimo' : ''}</p>
    <div class="cat-item-grid">
      ${results.map(({ item, category, subcategory }) => renderItemCard(item, category, subcategory, { showContextBadge: true })).join('')}
    </div>
  `;
}

function renderView() {
  const container = q('cat-view');
  if (!container) return;

  renderBreadcrumbBar();
  renderCategoryNav();

  if (state.type === 'home') renderHome(container);
  else if (state.type === 'category') renderCategory(container, state.categoryId, state.subcategoryId);
  else if (state.type === 'search') renderSearchResults(container, state.query);

  updateCardBadges();
  initRowScrollers(container);
}

// ---- Breadcrumb + botão voltar contextual ----

function renderBreadcrumbBar() {
  const el = q('cat-breadcrumb');
  if (!el) return;

  const crumbs = [`<button type="button" class="cat-crumb" data-crumb="home">Produtos</button>`];
  let backLabel = null;
  currentBackAction = null;

  if (state.type === 'category') {
    const category = getCategoryById(state.categoryId);
    if (category) {
      crumbs.push(`<button type="button" class="cat-crumb" data-crumb="category" data-id="${esc(category.id)}">${esc(category.name)}</button>`);
      const sub = state.subcategoryId && category.subcategories.find((s) => s.id === state.subcategoryId);
      if (sub) {
        crumbs.push(`<span class="cat-crumb cat-crumb-current">${esc(sub.name)}</span>`);
        backLabel = 'Voltar para todos os produtos da categoria';
        currentBackAction = () => selectSubcategoryFilter(category.id, null);
      } else {
        backLabel = 'Voltar para todas as categorias';
        currentBackAction = () => goHome();
      }
    }
  } else if (state.type === 'search') {
    crumbs.push(`<span class="cat-crumb cat-crumb-current">Busca: "${esc(state.query)}"</span>`);
    backLabel = 'Voltar para todas as categorias';
    currentBackAction = () => goHome();
  }

  el.innerHTML = `
    ${backLabel ? `<button type="button" class="cat-back-btn" id="cat-back-btn"><span aria-hidden="true">←</span> ${esc(backLabel)}</button>` : ''}
    <div class="cat-breadcrumb-row">${crumbs.join('<span class="cat-crumb-sep" aria-hidden="true">›</span>')}</div>
  `;
}

function onBreadcrumbClick(e) {
  const homeBtn = e.target.closest('[data-crumb="home"]');
  if (homeBtn) {
    window.trackEvent?.('catalog_back', { from: state.type, to: 'home' });
    goHome();
    return;
  }
  const catBtn = e.target.closest('[data-crumb="category"]');
  if (catBtn) {
    openCategory(catBtn.dataset.id, 'breadcrumb');
    return;
  }
  const backBtn = e.target.closest('#cat-back-btn');
  if (backBtn && currentBackAction) {
    window.trackEvent?.('catalog_back', { from: state.type, subcategory_id: state.subcategoryId || undefined });
    currentBackAction();
  }
}

// ---- Roteamento / URL / histórico ----

function stateFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const categoria = params.get('categoria');
  const query = params.get('q');
  if (categoria && getCategoryById(categoria)) {
    return { type: 'category', categoryId: categoria, subcategoryId: params.get('subcategoria') || null };
  }
  if (query) return { type: 'search', query };
  return { type: 'home' };
}

function buildUrl(next) {
  const params = new URLSearchParams();
  if (next.type === 'category') {
    params.set('categoria', next.categoryId);
    if (next.subcategoryId) params.set('subcategoria', next.subcategoryId);
  } else if (next.type === 'search') {
    params.set('q', next.query);
  }
  const qs = params.toString();
  return window.location.pathname + (qs ? `?${qs}` : '');
}

function scrollToTopOfState(next) {
  if (next.type === 'home') {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
    return;
  }
  q('cat-catalog-anchor')?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

function go(next, { scrollToTop = false } = {}) {
  if (historyReady) {
    window.history.replaceState({ ...state, scrollY: window.scrollY }, '', buildUrl(state));
  }
  window.history.pushState({ ...next }, '', buildUrl(next));
  historyReady = true;
  state = next;
  renderView();
  if (scrollToTop) scrollToTopOfState(next);
}

function openCategory(categoryId, source) {
  const prevType = state.type;
  go({ type: 'category', categoryId, subcategoryId: null }, { scrollToTop: true });
  window.trackEvent?.('catalog_category_switch', { category_id: categoryId, source: source || prevType });
}

function selectSubcategoryFilter(categoryId, subcategoryId) {
  go({ type: 'category', categoryId, subcategoryId: subcategoryId || null }, { scrollToTop: false });
  if (subcategoryId) {
    window.trackEvent?.('catalog_subcategory_filter', { category_id: categoryId, subcategory_id: subcategoryId });
  } else {
    window.trackEvent?.('catalog_filter_all', { category_id: categoryId });
  }
}

function goHome() {
  go({ type: 'home' }, { scrollToTop: true });
}

function goSearch(query) {
  go({ type: 'search', query }, { scrollToTop: true });
}

function syncSearchInputs() {
  const value = state.type === 'search' ? state.query : '';
  document.querySelectorAll('.cat-search-input').forEach((el) => {
    if (el.value !== value) el.value = value;
  });
}

window.addEventListener('popstate', (e) => {
  state = e.state || stateFromLocation();
  syncSearchInputs();
  renderView();
  const y = e.state?.scrollY;
  requestAnimationFrame(() => window.scrollTo(0, typeof y === 'number' ? y : 0));
});

// ---- Busca (elemento dominante do hero + espelho compacto na barra sticky) ----

function initSearch() {
  const inputs = Array.from(document.querySelectorAll('.cat-search-input'));
  if (inputs.length === 0) return;

  const runSearch = debounce((value) => {
    const termo = value.trim();
    if (!termo) {
      if (state.type === 'search') goHome();
      return;
    }
    goSearch(termo);
  }, 260);

  inputs.forEach((input) => {
    input.addEventListener('focus', () => window.trackEvent?.('catalog_search_focus', { viewport_type: window.innerWidth < 768 ? 'mobile' : 'desktop' }), { once: true });
    input.addEventListener('input', () => {
      inputs.forEach((other) => { if (other !== input) other.value = input.value; });
      runSearch(input.value);
    });
  });

  document.querySelectorAll('.cat-search-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.cat-search-input');
      const termo = (input?.value || '').trim();
      if (termo) {
        window.trackEvent?.('catalog_search_submit', { search_term: termo });
        goSearch(termo);
      }
    });
  });
}

// ---- Listas rápidas (atalhos compactos) ----

function quickListsHtml() {
  const lists = getQuickLists();
  if (lists.length === 0) return '';
  window.trackEvent?.('catalog_quick_collection_view', { collection_count: lists.length });
  return `
    <h2 class="cat-section-title">Comece por uma necessidade</h2>
    <div class="cat-quicklist-row">
      ${lists
        .map(
          (ql) => `
        <button type="button" class="cat-quicklist-pill" data-quicklist-open="${esc(ql.id)}">
          <span class="cat-quicklist-pill-icon" aria-hidden="true">${ql.icon}</span>
          <span class="cat-quicklist-pill-text">
            <strong>${esc(ql.label)}</strong>
            <span>${ql.items.length} ${ql.items.length === 1 ? 'item' : 'itens'}</span>
          </span>
        </button>
      `,
        )
        .join('')}
    </div>
  `;
}

function openQuickListDrawer(quickListId) {
  const list = getQuickLists().find((ql) => ql.id === quickListId);
  if (!list) return;

  window.trackEvent?.('quick_list_open', { quick_list_id: quickListId });
  window.trackEvent?.('catalog_quick_collection_open', { quick_list_id: quickListId });

  openDrawer({
    id: 'quicklist-' + quickListId,
    title: list.label,
    render(body) {
      body.innerHTML = `
        <p class="cat-drawer-desc">${esc(list.description || '')}</p>
        <p class="cat-drawer-hint">Marque os itens que você quer adicionar à sua lista — nada é adicionado automaticamente.</p>
        <div class="cat-quicklist-options">
          ${list.items
            .map(
              (item) => `
            <label class="cat-quicklist-option">
              <input type="checkbox" value="${esc(item.id)}" checked />
              <span>${esc(item.name)}</span>
              <button type="button" class="cat-list-row-btn" data-quicklist-item-options="${esc(item.id)}">Ver opções</button>
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
      body.querySelectorAll('[data-quicklist-item-options]').forEach((btn) => {
        btn.addEventListener('click', () => handleOpenOptions(btn.dataset.quicklistItemOptions));
      });
      body.querySelector('#cat-quicklist-confirm').addEventListener('click', (e) => {
        const checked = Array.from(body.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value);
        checked.forEach((id) => {
          const item = getItemById(id);
          if (item) {
            quickAddItem({ catalogItemId: item.id, name: item.name });
            celebrateAdd(e.currentTarget, item.name);
          }
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

// ---- Busca sticky: só assume a função quando a busca do hero sai da viewport ----

function initStickySearchReveal() {
  const heroSearch = document.querySelector('.cat-search-form-hero');
  const toolbar = q('cat-toolbar-sticky');
  if (!toolbar) return;
  if (!heroSearch || !('IntersectionObserver' in window)) {
    toolbar.classList.add('cat-toolbar-search-active');
    return;
  }
  const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 96;
  const io = new IntersectionObserver(
    ([entry]) => toolbar.classList.toggle('cat-toolbar-search-active', !entry.isIntersecting),
    { rootMargin: `-${headerH + 8}px 0px 0px 0px` },
  );
  io.observe(heroSearch);
}

// ---- Inicialização ----

export function initCatalog() {
  state = stateFromLocation();
  window.history.replaceState({ ...state, scrollY: 0 }, '', buildUrl(state));
  historyReady = true;

  initSearch();
  initListUI();
  syncSearchInputs();
  initStickySearchReveal();

  q('cat-view')?.addEventListener('click', onCatViewClick);
  q('cat-rail')?.addEventListener('click', onCatViewClick);
  q('cat-breadcrumb')?.addEventListener('click', onBreadcrumbClick);
  q('cat-suggestions')?.addEventListener('click', onSuggestionsClick);

  q('cat-open-categories-btn')?.addEventListener('click', () => openAllCategoriesDrawer());

  subscribe(() => {
    updateCardBadges();
  });

  renderView();
  window.trackEvent?.('catalog_view', { viewport_type: window.innerWidth < 768 ? 'mobile' : 'desktop' });
}

document.addEventListener('DOMContentLoaded', initCatalog);
