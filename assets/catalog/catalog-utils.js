/* ======================================================
   SARTEC — Catálogo — Utilitários compartilhados
   ====================================================== */

/** Escapa texto para uso seguro em innerHTML (conteúdo ou atributo). */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Debounce simples — evita disparar a busca a cada tecla digitada. */
export function debounce(fn, wait = 220) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const VARIANT_BG_CLASS = {
  azul: 'cat-card-bg-azul',
  vermelho: 'cat-card-bg-vermelho',
  misto: 'cat-card-bg-misto',
  neutro: 'cat-card-bg-neutro',
};

export function variantBgClass(variant) {
  return VARIANT_BG_CLASS[variant] || VARIANT_BG_CLASS.neutro;
}
