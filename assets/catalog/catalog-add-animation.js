/* ======================================================
   SARTEC — Catálogo — Animação de confirmação ao adicionar
   Chip circular que voa do botão clicado até "Minha lista",
   seguido de um bump no botão e um bloquinho de papel com o
   nome do produto. Só feedback visual — a lista e os
   contadores continuam sendo a fonte de verdade, atualizados
   antes desta animação sequer começar. Sem carrinho, sem
   emoji 🛒: usa o mesmo ícone de "Minha lista" (📋).
   ====================================================== */

const FLIGHT_MS = 550;
const FLIGHT_FALLBACK_MS = FLIGHT_MS + 120;
const WRITE_MS = 850;
const HOLD_MS = 1000;
const EXIT_MS = 280;
const BATCH_WINDOW_MS = 180;

let paperEl = null;
let pendingNames = [];
let batchTimer = null;
let writeTimer = null;
let hideTimer = null;
let exitTimer = null;
let repositionBound = false;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
}

/** Botão "Minha lista" atualmente visível — prioriza a barra fixa mobile quando ela é a interface principal. */
function getListTargetEl() {
  const mobileBar = document.getElementById('cat-mobile-bar');
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  if (isMobile && isVisible(mobileBar)) return mobileBar;
  const headerBtn = document.querySelector('.cat-toolbar-inner [data-cat-open-list]');
  if (isVisible(headerBtn)) return headerBtn;
  if (isVisible(mobileBar)) return mobileBar;
  return headerBtn || mobileBar || null;
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function bump(el) {
  if (!el) return;
  el.classList.remove('cat-list-btn-bump');
  // força reflow para reiniciar a animação mesmo em cliques muito próximos
  void el.offsetWidth;
  el.classList.add('cat-list-btn-bump');
}

function flyChip(originEl, targetEl, onArrive) {
  const originRect = originEl.getBoundingClientRect();
  if (originRect.width === 0 && originRect.height === 0) {
    onArrive();
    return;
  }
  const targetRect = targetEl.getBoundingClientRect();
  const from = rectCenter(originRect);
  const to = rectCenter(targetRect);

  const chip = document.createElement('div');
  chip.className = 'cat-fly-chip';
  chip.setAttribute('aria-hidden', 'true');
  chip.textContent = '📋';
  chip.style.left = `${from.x}px`;
  chip.style.top = `${from.y}px`;
  document.body.appendChild(chip);

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    chip.remove();
    onArrive();
  };

  chip.addEventListener('transitionend', finish, { once: true });
  window.setTimeout(finish, FLIGHT_FALLBACK_MS);

  requestAnimationFrame(() => {
    chip.style.left = `${to.x}px`;
    chip.style.top = `${to.y}px`;
    chip.classList.add('cat-fly-chip-flying');
  });
}

// ---- Papel de confirmação ("Minha lista") ----

function ensurePaperEl() {
  if (paperEl) return paperEl;
  paperEl = document.createElement('div');
  paperEl.className = 'cat-list-paper';
  paperEl.hidden = true;
  paperEl.innerHTML = `
    <span class="cat-list-paper-label">Minha lista</span>
    <span class="cat-list-paper-text" id="cat-list-paper-text"></span>
    <span class="cat-list-paper-check" aria-hidden="true">✓</span>
  `;
  document.body.appendChild(paperEl);

  if (!repositionBound) {
    repositionBound = true;
    const reposition = () => {
      if (!paperEl.hidden) positionPaper();
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
  }
  return paperEl;
}

function positionPaper() {
  const target = getListTargetEl();
  if (!target || !paperEl) return;
  const rect = target.getBoundingClientRect();
  const margin = 12;
  const w = paperEl.offsetWidth || 200;
  const h = paperEl.offsetHeight || 90;

  let left = rect.right - w;
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - w));

  let top = rect.bottom + 10;
  if (top + h > window.innerHeight - margin) {
    top = rect.top - h - 10;
  }
  top = Math.max(margin, top);

  paperEl.style.left = `${left}px`;
  paperEl.style.top = `${top}px`;
}

function writeText(el, text, duration, onDone) {
  el.textContent = '';
  const chars = Array.from(text);
  const stepTime = Math.max(14, duration / Math.max(chars.length, 1));
  let i = 0;
  clearInterval(writeTimer);
  writeTimer = window.setInterval(() => {
    el.textContent += chars[i] || '';
    i++;
    if (i >= chars.length) {
      clearInterval(writeTimer);
      onDone?.();
    }
  }, stepTime);
}

function flushBatch() {
  const names = pendingNames;
  pendingNames = [];
  if (names.length === 0) return;
  const text = names.length > 1 ? `${names.length} itens adicionados à lista` : names[names.length - 1];
  showPaper(text);
}

function showPaper(text) {
  const paper = ensurePaperEl();
  const textEl = paper.querySelector('#cat-list-paper-text');
  const checkEl = paper.querySelector('.cat-list-paper-check');

  clearTimeout(hideTimer);
  clearTimeout(exitTimer);
  clearInterval(writeTimer);

  paper.hidden = false;
  paper.classList.remove('cat-list-paper-exit');
  // reflow para permitir reiniciar a transição de entrada mesmo se já visível
  void paper.offsetWidth;
  paper.classList.add('cat-list-paper-visible');
  checkEl.classList.remove('cat-list-paper-check-show');
  positionPaper();

  const reduce = reducedMotion();
  if (reduce) {
    textEl.textContent = text;
    checkEl.classList.add('cat-list-paper-check-show');
  } else {
    writeText(textEl, text, WRITE_MS, () => checkEl.classList.add('cat-list-paper-check-show'));
  }

  const holdStart = reduce ? 250 : WRITE_MS;
  hideTimer = window.setTimeout(() => {
    paper.classList.add('cat-list-paper-exit');
    paper.classList.remove('cat-list-paper-visible');
    exitTimer = window.setTimeout(() => {
      paper.hidden = true;
    }, reduce ? 150 : EXIT_MS);
  }, holdStart + HOLD_MS);
}

function queuePaper(name) {
  pendingNames.push(name || 'Item');
  clearTimeout(batchTimer);
  batchTimer = window.setTimeout(flushBatch, BATCH_WINDOW_MS);
}

/**
 * Dispara a animação de confirmação de uma adição bem-sucedida à lista.
 * A lista já foi atualizada antes desta chamada — isto é só feedback visual.
 * @param {HTMLElement|null} originEl botão que originou a adição (Adicionar, Adicionar mais, opção confirmada...)
 * @param {string} productName nome do produto adicionado
 */
export function celebrateAdd(originEl, productName) {
  const targetEl = getListTargetEl();

  if (reducedMotion()) {
    bump(targetEl);
    queuePaper(productName);
    return;
  }

  if (!originEl || !targetEl || !isVisible(originEl) || !isVisible(targetEl)) {
    queuePaper(productName);
    return;
  }

  flyChip(originEl, targetEl, () => {
    bump(targetEl);
    queuePaper(productName);
  });
}
