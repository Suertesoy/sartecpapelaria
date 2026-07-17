/* ======================================================
   SARTEC — Catálogo — Fábrica de itens/subcategorias
   Reduz repetição ao declarar os ~260 tipos de produto da
   taxonomia. Cada categoria usa makeItems/makeSubcategory.
   ====================================================== */

/**
 * @typedef {Object} CatalogItem
 * @property {string} id
 * @property {string} name
 * @property {string} [shortDescription]
 * @property {string} image
 * @property {string[]} synonyms
 * @property {string} attributeProfile
 * @property {string[]} relatedItemIds
 * @property {string[]} tags
 * @property {'azul'|'vermelho'|'misto'|'neutro'} visualVariant
 * @property {boolean} active
 * @property {'principal'|'complementar'|'futura'} launchPriority
 */

const VARIANT_CYCLE = ['neutro', 'azul', 'neutro', 'vermelho', 'azul', 'neutro', 'misto', 'vermelho'];

/** Cria um gerador determinístico de variantes visuais (distribui azul/vermelho/misto/neutro). */
export function createVariantCycler(seed = 0) {
  let i = seed;
  return () => VARIANT_CYCLE[(i++) % VARIANT_CYCLE.length];
}

/**
 * @param {string} defaultTagBase
 * @param {string} defaultProfile
 * @param {() => string} nextVariant
 * @param {[string, string, Object=]} entries
 * @param {'principal'|'complementar'|'futura'} [defaultPriority]
 * @returns {CatalogItem[]}
 */
export function makeItems(defaultTagBase, defaultProfile, nextVariant, entries, defaultPriority = 'principal') {
  return entries.map(([id, name, extra = {}]) => ({
    id,
    name,
    shortDescription: extra.desc || undefined,
    image: `assets/catalog/images/${id}.webp`,
    synonyms: extra.syn || [],
    attributeProfile: extra.profile || defaultProfile,
    relatedItemIds: extra.rel || [],
    tags: Array.from(new Set([defaultTagBase, ...(extra.tags || [])].filter(Boolean))),
    visualVariant: extra.variant || nextVariant(),
    active: true,
    launchPriority: extra.priority || defaultPriority,
  }));
}

export function makeSubcategory(id, name, order, items, description) {
  return { id, name, description, order, items };
}

export function makeCategory(id, name, description, order, featured, subcategories) {
  return { id, name, description, image: undefined, order, featured, subcategories };
}
