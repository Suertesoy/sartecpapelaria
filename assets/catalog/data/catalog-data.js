/* ======================================================
   SARTEC — Catálogo — Agregador de dados
   Junta as categorias, monta índices e expõe busca,
   sugestões relacionadas e listas rápidas resolvidas.
   ====================================================== */

import { CATEGORY_CADERNOS_AGENDAS_FICHARIO } from './categories/cadernos-agendas-fichario.js';
import { CATEGORY_CANETAS_LAPIS_MARCADORES } from './categories/canetas-lapis-marcadores.js';
import { CATEGORY_PAPEIS_EVA_MATERIAIS } from './categories/papeis-eva-materiais.js';
import { CATEGORY_COLAS_FITAS_ADESIVOS_CORRECAO } from './categories/colas-fitas-adesivos-correcao.js';
import { CATEGORY_ARTE_PINTURA_ARTESANATO } from './categories/arte-pintura-artesanato.js';
import { CATEGORY_ACESSORIOS_ESCOLARES_GEOMETRIA } from './categories/acessorios-escolares-geometria.js';
import { CATEGORY_ORGANIZACAO_ESCRITORIO } from './categories/organizacao-escritorio.js';
import { CATEGORY_MOCHILAS_ESTOJOS_LANCHEIRAS } from './categories/mochilas-estojos-lancheiras.js';
import { CATEGORY_LIVROS_ATIVIDADES } from './categories/livros-atividades.js';
import { CATEGORY_PRESENTES_FESTAS_EMBALAGENS } from './categories/presentes-festas-embalagens.js';
import { CATEGORY_TECNOLOGIA_IMPRESSAO_ELETRONICOS } from './categories/tecnologia-impressao-eletronicos.js';
import { CATEGORY_UTILIDADES_LIMPEZA } from './categories/utilidades-limpeza.js';

import { RELATED_ITEMS_MATRIX } from './relatedItems.js';
import { QUICK_LISTS } from './quickLists.js';
import { resolverSinonimo, normalizeText, tokenize } from './synonyms.js';
import { getAttributeProfile } from './attributeProfiles.js';

export const CATALOG_CATEGORIES = [
  CATEGORY_CADERNOS_AGENDAS_FICHARIO,
  CATEGORY_CANETAS_LAPIS_MARCADORES,
  CATEGORY_PAPEIS_EVA_MATERIAIS,
  CATEGORY_COLAS_FITAS_ADESIVOS_CORRECAO,
  CATEGORY_ARTE_PINTURA_ARTESANATO,
  CATEGORY_ACESSORIOS_ESCOLARES_GEOMETRIA,
  CATEGORY_ORGANIZACAO_ESCRITORIO,
  CATEGORY_MOCHILAS_ESTOJOS_LANCHEIRAS,
  CATEGORY_LIVROS_ATIVIDADES,
  CATEGORY_PRESENTES_FESTAS_EMBALAGENS,
  CATEGORY_TECNOLOGIA_IMPRESSAO_ELETRONICOS,
  CATEGORY_UTILIDADES_LIMPEZA,
].sort((a, b) => a.order - b.order);

/** Número de tipos de produto ativos numa categoria (soma das subcategorias). */
export function getCategoryItemCount(category) {
  return category.subcategories.reduce((acc, s) => acc + s.items.filter((it) => it.active).length, 0);
}

/** Subcategorias de uma categoria com a contagem de itens ativos, ordenadas, só as com itens. */
export function getSubcategoryCounts(category) {
  return [...category.subcategories]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, name: s.name, count: s.items.filter((it) => it.active).length }))
    .filter((s) => s.count > 0);
}

// ---- Índices ----

/** @type {Map<string, { item: any, category: any, subcategory: any }>} */
export const ITEM_INDEX = new Map();

/** @type {Map<string, string[]>} tag -> ids de itens ativos com essa tag, na ordem do catálogo */
const TAG_INDEX = new Map();

/** @type {{ item: any, category: any, subcategory: any, searchText: string, tokens: string[] }[]} */
const SEARCH_INDEX = [];

for (const category of CATALOG_CATEGORIES) {
  for (const subcategory of [...category.subcategories].sort((a, b) => a.order - b.order)) {
    for (const item of subcategory.items) {
      if (!item.active) continue;
      ITEM_INDEX.set(item.id, { item, category, subcategory });

      for (const tag of item.tags) {
        if (!TAG_INDEX.has(tag)) TAG_INDEX.set(tag, []);
        TAG_INDEX.get(tag).push(item.id);
      }

      const searchText = normalizeText(
        [item.name, category.name, subcategory.name, ...(item.tags || []), ...(item.synonyms || [])].join(' '),
      );
      SEARCH_INDEX.push({ item, category, subcategory, searchText, tokens: tokenize(searchText) });
    }
  }
}

export function getItemById(id) {
  return ITEM_INDEX.get(id)?.item || null;
}

export function getItemContext(id) {
  return ITEM_INDEX.get(id) || null;
}

export function getCategoryById(id) {
  return CATALOG_CATEGORIES.find((c) => c.id === id) || null;
}

// ---- Busca (nome, categoria, subcategoria, sinônimos, tags, pequenos erros de digitação) ----

/** Distância de Levenshtein simples, usada só para tolerar pequenos erros de digitação. */
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function tokenMatches(queryToken, entryTokens) {
  for (const t of entryTokens) {
    if (t === queryToken || t.includes(queryToken) || queryToken.includes(t)) return true;
    if (queryToken.length >= 4 && t.length >= 4 && levenshtein(queryToken, t) <= 1) return true;
    if (queryToken.length >= 7 && t.length >= 7 && levenshtein(queryToken, t) <= 2) return true;
  }
  return false;
}

/**
 * Busca itens ativos do catálogo por nome, categoria, subcategoria, sinônimo, tag
 * ou termo popular, tolerando pequenos erros de digitação.
 * @param {string} query
 * @returns {{ results: { item: any, category: any, subcategory: any }[], synonymTermUsed: boolean }}
 */
export function searchCatalog(query) {
  const termo = (query || '').trim();
  if (!termo) return { results: [], synonymTermUsed: false };

  const sinonimoId = resolverSinonimo(termo);
  let results = [];
  let synonymTermUsed = false;

  if (sinonimoId && ITEM_INDEX.has(sinonimoId)) {
    results.push(ITEM_INDEX.get(sinonimoId));
    synonymTermUsed = true;
  }

  const queryTokens = tokenize(termo);
  if (queryTokens.length > 0) {
    const scored = [];
    for (const entry of SEARCH_INDEX) {
      if (results.some((r) => r.item.id === entry.item.id)) continue;
      const matchedTokens = queryTokens.filter((qt) => tokenMatches(qt, entry.tokens));
      if (matchedTokens.length === 0) continue;
      const exactPhrase = entry.searchText.includes(normalizeText(termo));
      const score = matchedTokens.length + (exactPhrase ? 10 : 0);
      scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    results = results.concat(scored.map((s) => s.entry));
  }

  return { results, synonymTermUsed };
}

// ---- Sugestões relacionadas ----

/**
 * Sugere até `limit` itens relacionados a `item`, priorizando a matriz
 * explícita por tag e complementando por tags em comum quando necessário.
 * Nunca sugere o próprio item nem itens já presentes em `excludeIds`.
 * @param {any} item
 * @param {Set<string>} excludeIds
 * @param {number} [limit]
 */
export function getRelatedItems(item, excludeIds, limit = 4) {
  if (!item) return [];
  const exclude = new Set(excludeIds);
  exclude.add(item.id);
  const picked = [];
  const pickedIds = new Set();

  function tryAddByTag(tag) {
    const ids = TAG_INDEX.get(tag) || [];
    for (const id of ids) {
      if (picked.length >= limit) return;
      if (exclude.has(id) || pickedIds.has(id)) continue;
      const ctx = ITEM_INDEX.get(id);
      if (!ctx) continue;
      picked.push(ctx.item);
      pickedIds.add(id);
    }
  }

  // 1) Relações explícitas da matriz, na ordem de prioridade definida por tag do item
  for (const tag of item.tags) {
    const relatedTags = RELATED_ITEMS_MATRIX[tag];
    if (!relatedTags) continue;
    for (const relatedTag of relatedTags) {
      if (picked.length >= limit) break;
      tryAddByTag(relatedTag);
    }
  }

  // 2) Fallback — outros itens que compartilham tag com o item (mesma atividade/subcategoria)
  if (picked.length < limit) {
    for (const tag of item.tags) {
      if (picked.length >= limit) break;
      tryAddByTag(tag);
    }
  }

  return picked.slice(0, limit);
}

// ---- Listas rápidas ----

/** Resolve as tags de uma lista rápida para os itens ativos correspondentes do catálogo. */
export function resolveQuickList(quickList) {
  const seen = new Set();
  const items = [];
  for (const tag of quickList.itemTags) {
    const ids = TAG_INDEX.get(tag) || [];
    const id = ids[0];
    if (!id || seen.has(id)) continue;
    const ctx = ITEM_INDEX.get(id);
    if (!ctx) continue;
    seen.add(id);
    items.push(ctx.item);
  }
  return items;
}

export function getQuickLists() {
  return QUICK_LISTS.map((ql) => ({ ...ql, items: resolveQuickList(ql) })).filter((ql) => ql.items.length > 0);
}

export { getAttributeProfile };
