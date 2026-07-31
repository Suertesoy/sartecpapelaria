/* ======================================================
   SARTEC — Home — demonstração animada do catálogo
   Reaproveita a mesma animação de "voar até Minha lista" e o
   bloco de papel que escreve o nome do produto já usados no
   catálogo real (assets/catalog/catalog-add-animation.js).
   Aqui ela roda em loop, sobre elementos só decorativos
   (aria-hidden), sem tocar no localStorage nem na lista real.
   ====================================================== */

import { celebrateAdd, resetCelebrateState } from './catalog/catalog-add-animation.js';

const PRODUCTS = [
  { key: 'caderno', name: 'Caderno' },
  { key: 'caneta', name: 'Caneta' },
  { key: 'estojo', name: 'Estojo' },
];

const CLICK_HOLD_MS = 420;   // tempo do cursor parado sobre o botão antes do "clique"
const CLICK_FX_MS = 180;     // duração do destaque de clique no botão
const STEP_PAUSE_MS = 1500;  // pausa entre um produto e o próximo
const CYCLE_HOLD_MS = 2600;  // tempo com os 3 itens adicionados antes de reiniciar
const RESTART_GAP_MS = 500;  // pausa antes do próximo ciclo começar

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initHomeCatalogDemo() {
  const root = document.getElementById('hcp-demo');
  if (!root) return;

  const card = root.querySelector('.hcp-preview-card');
  const cursor = document.getElementById('hcp-demo-cursor');
  const listPill = document.getElementById('hcp-list-pill');
  const countEl = document.getElementById('hcp-list-count');
  const readyEl = document.getElementById('hcp-preview-ready');

  const items = PRODUCTS.map((p) => ({
    ...p,
    addEl: document.getElementById(`hcp-add-${p.key}`),
  })).filter((p) => p.addEl);

  if (!card || !cursor || !listPill || !countEl || items.length === 0) return;

  let cycleToken = 0;
  const timers = [];

  function after(ms, fn) {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers.length = 0;
  }

  function resetVisualState() {
    items.forEach((it) => {
      it.addEl.textContent = '+ Adicionar';
      it.addEl.classList.remove('hcp-preview-product-add-done', 'hcp-preview-product-add-pulse');
    });
    countEl.textContent = '0';
    if (readyEl) readyEl.classList.add('hcp-preview-ready-hide');
    cursor.classList.remove('hcp-demo-cursor-show', 'hcp-demo-cursor-click');
    resetCelebrateState();
  }

  function setStaticFinalState() {
    clearTimers();
    items.forEach((it) => {
      it.addEl.textContent = 'Adicionado';
      it.addEl.classList.add('hcp-preview-product-add-done');
      it.addEl.classList.remove('hcp-preview-product-add-pulse');
    });
    countEl.textContent = String(items.length);
    if (readyEl) readyEl.classList.remove('hcp-preview-ready-hide');
    cursor.classList.remove('hcp-demo-cursor-show', 'hcp-demo-cursor-click');
  }

  function moveCursorTo(el) {
    const cardRect = card.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    cursor.style.left = `${elRect.left - cardRect.left + elRect.width / 2}px`;
    cursor.style.top = `${elRect.top - cardRect.top + elRect.height / 2}px`;
    cursor.classList.add('hcp-demo-cursor-show');
  }

  function addOne(index, token, onDone) {
    const it = items[index];
    moveCursorTo(it.addEl);

    after(CLICK_HOLD_MS, () => {
      if (token !== cycleToken) return;
      cursor.classList.add('hcp-demo-cursor-click');
      it.addEl.classList.add('hcp-preview-product-add-pulse');

      after(CLICK_FX_MS, () => {
        if (token !== cycleToken) return;
        cursor.classList.remove('hcp-demo-cursor-click');
        it.addEl.textContent = 'Adicionado';
        it.addEl.classList.add('hcp-preview-product-add-done');
        it.addEl.classList.remove('hcp-preview-product-add-pulse');

        // Mesma animação (voo até "Minha lista" + papel escrevendo o nome) do
        // catálogo real — só aponta para o pill decorativo desta demo.
        celebrateAdd(it.addEl, it.name, { getTarget: () => listPill });

        after(240, () => {
          if (token !== cycleToken) return;
          countEl.textContent = String(index + 1);
          onDone();
        });
      });
    });
  }

  function runCycle(token) {
    resetVisualState();

    function next(i) {
      if (token !== cycleToken) return;
      const isLast = i === items.length - 1;
      addOne(i, token, () => {
        if (token !== cycleToken) return;
        if (!isLast) {
          after(STEP_PAUSE_MS, () => next(i + 1));
          return;
        }
        // Último item confirmado: mostra "pronta para orçamento" já, sem
        // herdar a pausa entre produtos, e só então segura o estado final.
        if (readyEl) readyEl.classList.remove('hcp-preview-ready-hide');
        after(CYCLE_HOLD_MS, () => {
          if (token !== cycleToken) return;
          after(RESTART_GAP_MS, () => runCycle(token));
        });
      });
    }

    next(0);
  }

  function start() {
    if (reducedMotion()) {
      cycleToken++;
      clearTimers();
      setStaticFinalState();
      return;
    }
    cycleToken++;
    runCycle(cycleToken);
  }

  function stop() {
    cycleToken++; // invalida quaisquer callbacks pendentes
    clearTimers();
  }

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => {
    stop();
    start();
  });

  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) start();
        else stop();
      });
    },
    { threshold: 0.2 },
  );
  observer.observe(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeCatalogDemo);
} else {
  initHomeCatalogDemo();
}
