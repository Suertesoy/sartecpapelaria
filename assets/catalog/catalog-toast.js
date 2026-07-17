/* ======================================================
   SARTEC — Catálogo — Confirmação (toast) de item adicionado
   Região anunciável (aria-live) com opção de "Desfazer".
   ====================================================== */

import { esc } from './catalog-utils.js';

let container = null;
let timer = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'catalog-toast';
  container.className = 'cat-toast';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function showToast(message, { actionLabel, onAction } = {}) {
  const el = ensureContainer();
  clearTimeout(timer);
  el.innerHTML = `<span class="cat-toast-msg">${esc(message)}</span>`;
  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      onAction();
      hideToast();
    });
    el.appendChild(btn);
  }
  el.classList.add('cat-toast-visible');
  timer = setTimeout(hideToast, 5000);
}

export function hideToast() {
  if (!container) return;
  container.classList.remove('cat-toast-visible');
}
