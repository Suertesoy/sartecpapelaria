/* ======================================================
   SARTEC — Catálogo — "Vistos recentemente"
   Guarda só o id do item de catálogo e o instante do acesso,
   nunca dados pessoais. Persiste em localStorage; nunca quebra
   a página se o storage estiver indisponível ou o conteúdo
   salvo for inválido. Referências a itens fora do catálogo
   atual são descartadas silenciosamente na leitura.
   ====================================================== */

const STORAGE_KEY = 'sartec_catalog_recent_v1';
const MAX_ITEMS = 8;

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.itemId === 'string');
  } catch (_) {
    return [];
  }
}

function writeRaw(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (_) {
    /* storage indisponível — segue só em memória para esta sessão */
  }
}

/** Registra a visita a um item de catálogo (mais recente primeiro, sem duplicar). */
export function registerRecentlyViewed(itemId) {
  if (!itemId) return;
  const entries = readRaw().filter((e) => e.itemId !== itemId);
  entries.unshift({ itemId, viewedAt: Date.now() });
  writeRaw(entries.slice(0, MAX_ITEMS));
}

/**
 * Retorna até `limit` itens vistos recentemente, resolvidos contra o catálogo
 * atual via `resolve(itemId)`. Ids que não existem mais são descartados.
 */
export function getRecentlyViewed(resolve, limit = MAX_ITEMS) {
  const entries = readRaw();
  const resolved = [];
  for (const entry of entries) {
    const item = resolve(entry.itemId);
    if (item) resolved.push(item);
    if (resolved.length >= limit) break;
  }
  return resolved;
}
