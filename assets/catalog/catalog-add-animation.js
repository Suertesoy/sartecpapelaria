/* ======================================================
   SARTEC — Catálogo — Animação de confirmação ao adicionar
   Chip circular que voa do botão clicado até "Minha lista",
   seguido de um bump no botão. Nas três primeiras adições da
   sessão (contador em memória, não persistido — reinicia só
   ao recarregar a página), um bloquinho de papel acumula os
   nomes em linhas, escritas uma de cada vez por uma fila
   segura. Da quarta adição em diante, só fly + bump + toast.
   Sem carrinho, sem emoji 🛒: usa o ícone de "Minha lista" (📋).
   ====================================================== */

const FLIGHT_MS = 550;
const FLIGHT_FALLBACK_MS = FLIGHT_MS + 120;
const WRITE_MS = 850;
const HOLD_MS = 1000;
const REDUCED_HOLD_MS = 600;
const EXIT_MS = 280;
const MAX_PAPER_LINES = 3;

let paperEl = null;
let linesContainerEl = null;
let sessionAddCount = 0;
let writtenNames = [];
let lineQueue = [];
let isWriting = false;
let writeTimer = null;
let hideTimer = null;
let exitTimer = null;
let repositionBound = false;
let currentGetTarget = getListTargetEl;

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

  const label = document.createElement('span');
  label.className = 'cat-list-paper-label';
  label.textContent = 'Minha lista';

  linesContainerEl = document.createElement('div');
  linesContainerEl.className = 'cat-list-paper-lines';

  paperEl.appendChild(label);
  paperEl.appendChild(linesContainerEl);
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
  const target = currentGetTarget();
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

function createLineEl() {
  const line = document.createElement('div');
  line.className = 'cat-list-paper-line';
  const text = document.createElement('span');
  text.className = 'cat-list-paper-line-text';
  const check = document.createElement('span');
  check.className = 'cat-list-paper-line-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = '✓';
  line.appendChild(text);
  line.appendChild(check);
  return { line, text, check };
}

/** Garante que as linhas já escritas nesta sessão estejam no DOM (o papel pode ter sido esvaziado ao esconder). */
function syncStaticLines() {
  if (linesContainerEl.children.length === writtenNames.length) return;
  linesContainerEl.innerHTML = '';
  writtenNames.forEach((name) => {
    const { line, text, check } = createLineEl();
    text.textContent = name;
    check.classList.add('cat-list-paper-check-show');
    linesContainerEl.appendChild(line);
  });
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

function ensureVisible() {
  const paper = ensurePaperEl();
  clearTimeout(hideTimer);
  clearTimeout(exitTimer);
  paper.hidden = false;
  paper.classList.remove('cat-list-paper-exit');
  // reflow para permitir reiniciar a transição de entrada mesmo se já visível
  void paper.offsetWidth;
  paper.classList.add('cat-list-paper-visible');
  return paper;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  const reduce = reducedMotion();
  hideTimer = window.setTimeout(() => {
    if (!paperEl || paperEl.hidden) return;
    paperEl.classList.add('cat-list-paper-exit');
    paperEl.classList.remove('cat-list-paper-visible');
    exitTimer = window.setTimeout(() => {
      paperEl.hidden = true;
      linesContainerEl.innerHTML = '';
    }, reduce ? 150 : EXIT_MS);
  }, reduce ? REDUCED_HOLD_MS : HOLD_MS);
}

function writeNextLine(name) {
  ensureVisible();
  syncStaticLines();

  const { line, text, check } = createLineEl();
  linesContainerEl.appendChild(line);
  positionPaper();

  const finish = () => {
    writtenNames.push(name);
    check.classList.add('cat-list-paper-check-show');
    positionPaper();
    isWriting = false;
    processQueue();
  };

  if (reducedMotion()) {
    text.textContent = name;
    finish();
  } else {
    writeText(text, name, WRITE_MS, finish);
  }
}

function processQueue() {
  if (isWriting) return;
  if (lineQueue.length === 0) {
    scheduleHide();
    return;
  }
  isWriting = true;
  writeNextLine(lineQueue.shift());
}

function enqueueLine(name) {
  lineQueue.push(name || 'Item');
  processQueue();
}

/**
 * Dispara a animação de confirmação de uma adição bem-sucedida à lista.
 * A lista já foi atualizada antes desta chamada — isto é só feedback visual.
 * Conta toda chamada bem-sucedida (rápida, personalizada, manual, sugestão,
 * complementar ou lista rápida); só as três primeiras da sessão mostram o
 * papel — o fly + bump acontece sempre.
 * @param {HTMLElement|null} originEl botão que originou a adição (Adicionar, Adicionar com detalhes, opção confirmada...)
 * @param {string} productName nome do produto adicionado
 * @param {{ getTarget?: () => HTMLElement|null }} [opts] permite apontar para um "Minha lista" diferente do
 *   catálogo real (ex.: a demonstração da home, ver assets/home-catalog-demo.js). Sem opts, comportamento inalterado.
 */
export function celebrateAdd(originEl, productName, opts = {}) {
  currentGetTarget = opts.getTarget || getListTargetEl;
  const targetEl = currentGetTarget();
  const showPaperForThisAdd = sessionAddCount < MAX_PAPER_LINES;
  sessionAddCount++;

  const afterArrive = () => {
    bump(targetEl);
    if (showPaperForThisAdd) enqueueLine(productName);
  };

  if (reducedMotion()) {
    afterArrive();
    return;
  }

  if (!originEl || !targetEl || !isVisible(originEl) || !isVisible(targetEl)) {
    afterArrive();
    return;
  }

  flyChip(originEl, targetEl, afterArrive);
}

/**
 * Zera o estado do papel de confirmação (contador de sessão, linhas escritas e
 * fila pendente) e esconde o papel imediatamente. Usado pela demonstração em
 * loop da home para reiniciar cada ciclo como se fosse uma nova sessão.
 */
export function resetCelebrateState() {
  sessionAddCount = 0;
  writtenNames = [];
  lineQueue = [];
  isWriting = false;
  clearInterval(writeTimer);
  clearTimeout(hideTimer);
  clearTimeout(exitTimer);
  if (paperEl) {
    paperEl.hidden = true;
    paperEl.classList.remove('cat-list-paper-visible', 'cat-list-paper-exit');
    if (linesContainerEl) linesContainerEl.innerHTML = '';
  }
}
