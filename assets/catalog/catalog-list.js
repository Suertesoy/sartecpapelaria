/* ======================================================
   SARTEC — Catálogo — "Minha lista" (estado + persistência)
   Equivalente a um hook useCatalogList, em JS puro.
   Persiste em localStorage com chave versionada; nunca
   quebra a página se o storage estiver indisponível ou
   o conteúdo salvo for inválido.
   ====================================================== */

/**
 * @typedef {Object} CatalogListItem
 * @property {string} instanceId
 * @property {string} [catalogItemId]
 * @property {boolean} manual
 * @property {string} name
 * @property {number} quantity
 * @property {Record<string, string|number|boolean>} attributes
 * @property {string} [notes]
 * @property {string} createdAt
 */

const STORAGE_KEY = 'sartec_catalog_list_v1';
const STORAGE_VERSION = 1;

let items = [];
let isPersistent = true;
const listeners = new Set();

function uid() {
  return 'it_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function isValidStoredItem(raw) {
  return raw
    && typeof raw === 'object'
    && typeof raw.instanceId === 'string'
    && typeof raw.name === 'string'
    && Number.isFinite(raw.quantity);
}

function sanitize(raw) {
  return {
    instanceId: raw.instanceId,
    catalogItemId: typeof raw.catalogItemId === 'string' ? raw.catalogItemId : undefined,
    manual: !!raw.manual,
    name: raw.name,
    quantity: Math.max(1, Math.round(raw.quantity)),
    attributes: raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== STORAGE_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isValidStoredItem).map(sanitize);
  } catch (_) {
    return [];
  }
}

function persist() {
  if (!isPersistent) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, items }));
  } catch (_) {
    isPersistent = false;
  }
}

function notify() {
  persist();
  listeners.forEach((cb) => {
    try { cb(items); } catch (_) { /* listener não pode derrubar o app */ }
  });
}

items = load();

/** Assina mudanças na lista. Retorna função para cancelar a assinatura. */
export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getList() {
  return items;
}

export function getTotalQuantity() {
  return items.reduce((acc, it) => acc + it.quantity, 0);
}

export function getItemCount() {
  return items.length;
}

function attributesAreDefault(attributes) {
  return !attributes || Object.values(attributes).every((v) => v === '' || v === undefined || v === null);
}

/**
 * Adição rápida — uma unidade, "Sem preferência". Se já existir uma entrada
 * do mesmo item de catálogo sem personalização, apenas soma a quantidade.
 * @param {{ catalogItemId: string, name: string }} params
 * @returns {{ instanceId: string, mergedIntoExisting: boolean }}
 */
export function quickAddItem({ catalogItemId, name }) {
  const existing = items.find(
    (it) => it.catalogItemId === catalogItemId && !it.manual && attributesAreDefault(it.attributes) && !it.notes,
  );
  if (existing) {
    existing.quantity += 1;
    notify();
    return { instanceId: existing.instanceId, mergedIntoExisting: true };
  }
  const novo = {
    instanceId: uid(),
    catalogItemId,
    manual: false,
    name,
    quantity: 1,
    attributes: {},
    notes: undefined,
    createdAt: new Date().toISOString(),
  };
  items = [...items, novo];
  notify();
  return { instanceId: novo.instanceId, mergedIntoExisting: false };
}

/**
 * Adição personalizada (gaveta) ou item manual — sempre cria uma nova linha,
 * já que atributos/observações diferenciam a intenção do cliente.
 * @param {{ catalogItemId?: string, manual?: boolean, name: string, quantity?: number, attributes?: Object, notes?: string }} params
 */
export function addCustomItem({ catalogItemId, manual = false, name, quantity = 1, attributes = {}, notes }) {
  const novo = {
    instanceId: uid(),
    catalogItemId,
    manual,
    name,
    quantity: Math.max(1, Math.round(quantity) || 1),
    attributes: attributes || {},
    notes: notes && notes.trim() ? notes.trim() : undefined,
    createdAt: new Date().toISOString(),
  };
  items = [...items, novo];
  notify();
  return novo.instanceId;
}

export function updateItem(instanceId, patch) {
  const idx = items.findIndex((it) => it.instanceId === instanceId);
  if (idx < 0) return;
  const atual = items[idx];
  const atualizado = { ...atual, ...patch };
  if (patch.quantity !== undefined) atualizado.quantity = Math.max(1, Math.round(patch.quantity) || 1);
  if (patch.notes !== undefined) atualizado.notes = patch.notes && patch.notes.trim() ? patch.notes.trim() : undefined;
  items = items.map((it) => (it.instanceId === instanceId ? atualizado : it));
  notify();
}

export function removeItem(instanceId) {
  const removido = items.find((it) => it.instanceId === instanceId);
  items = items.filter((it) => it.instanceId !== instanceId);
  notify();
  return removido || null;
}

export function undoRemove(removedItem, index) {
  if (!removedItem) return;
  const copia = [...items];
  const pos = Math.min(index ?? copia.length, copia.length);
  copia.splice(pos, 0, removedItem);
  items = copia;
  notify();
}

export function duplicateItem(instanceId) {
  const original = items.find((it) => it.instanceId === instanceId);
  if (!original) return null;
  const copia = { ...original, instanceId: uid(), createdAt: new Date().toISOString() };
  const idx = items.findIndex((it) => it.instanceId === instanceId);
  items = [...items.slice(0, idx + 1), copia, ...items.slice(idx + 1)];
  notify();
  return copia.instanceId;
}

/** Reordena a lista conforme um array de instanceId na nova ordem desejada. */
export function reorderItems(orderedInstanceIds) {
  const byId = new Map(items.map((it) => [it.instanceId, it]));
  const reordenado = orderedInstanceIds.map((id) => byId.get(id)).filter(Boolean);
  if (reordenado.length !== items.length) return;
  items = reordenado;
  notify();
}

export function clearList() {
  items = [];
  notify();
}

export function isStoragePersistent() {
  return isPersistent;
}

// ---- Sincronização entre abas ----
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  items = load();
  listeners.forEach((cb) => {
    try { cb(items); } catch (_) { /* ignora */ }
  });
});
