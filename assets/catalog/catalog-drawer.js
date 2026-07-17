/* ======================================================
   SARTEC — Catálogo — Gaveta genérica (drawer / bottom sheet)
   Um único container reaproveitado por todas as gavetas
   (personalização, item manual, "Minha lista") — nunca mais
   de uma aberta ao mesmo tempo. Cuida de foco, Escape e
   retorno de foco ao elemento que abriu a gaveta.
   ====================================================== */

let activeDrawer = null;

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hidden && el.getClientRects().length > 0);
}

function ensureDrawerRoot() {
  let root = document.getElementById('catalog-drawer-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'catalog-drawer-root';
  root.innerHTML = `
    <div class="cat-drawer-backdrop" id="cat-drawer-backdrop" hidden></div>
    <div class="cat-drawer" id="cat-drawer" role="dialog" aria-modal="true" hidden tabindex="-1">
      <div class="cat-drawer-inner" id="cat-drawer-inner"></div>
    </div>
  `;
  document.body.appendChild(root);

  document.getElementById('cat-drawer-backdrop').addEventListener('click', () => closeDrawer());

  document.addEventListener('keydown', (e) => {
    if (!activeDrawer) return;
    if (e.key === 'Escape') {
      closeDrawer();
      return;
    }
    if (e.key === 'Tab') {
      const container = document.getElementById('cat-drawer');
      const focusable = getFocusable(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  return root;
}

/**
 * Abre a gaveta com o conteúdo fornecido. Fecha qualquer gaveta já aberta antes.
 * @param {{ id: string, title: string, render: (container: HTMLElement) => void, onClose?: () => void, size?: 'default'|'large' }} params
 */
export function openDrawer({ id, title, render, onClose, size = 'default' }) {
  if (activeDrawer) closeDrawer({ immediate: true });
  ensureDrawerRoot();

  const backdrop = document.getElementById('cat-drawer-backdrop');
  const drawer = document.getElementById('cat-drawer');
  const inner = document.getElementById('cat-drawer-inner');

  const returnFocusEl = document.activeElement;
  activeDrawer = { id, onClose, returnFocusEl };

  drawer.className = 'cat-drawer' + (size === 'large' ? ' cat-drawer-large' : '');
  drawer.setAttribute('data-drawer-id', id);
  drawer.removeAttribute('aria-labelledby');
  inner.innerHTML = '';

  const titleId = `cat-drawer-title-${id}`;
  inner.insertAdjacentHTML(
    'beforeend',
    `<div class="cat-drawer-head">
      <h2 class="cat-drawer-title" id="${titleId}">${title}</h2>
      <button type="button" class="cat-drawer-close" aria-label="Fechar">✕</button>
    </div>
    <div class="cat-drawer-body" id="cat-drawer-body"></div>`,
  );
  drawer.setAttribute('aria-labelledby', titleId);
  inner.querySelector('.cat-drawer-close').addEventListener('click', () => closeDrawer());

  render(inner.querySelector('#cat-drawer-body'));

  drawer.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add('cat-drawer-open');

  requestAnimationFrame(() => {
    drawer.classList.add('cat-drawer-visible');
    backdrop.classList.add('cat-drawer-backdrop-visible');
    const focusable = getFocusable(drawer);
    (focusable[0] || drawer).focus();
  });
}

export function closeDrawer(opts = {}) {
  if (!activeDrawer) return;
  const drawer = document.getElementById('cat-drawer');
  const backdrop = document.getElementById('cat-drawer-backdrop');
  const { onClose, returnFocusEl } = activeDrawer;
  const closingId = activeDrawer.id;
  activeDrawer = null;

  drawer.classList.remove('cat-drawer-visible');
  backdrop.classList.remove('cat-drawer-backdrop-visible');
  document.body.classList.remove('cat-drawer-open');

  const finish = () => {
    if (drawer.getAttribute('data-drawer-id') !== closingId) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    document.getElementById('cat-drawer-inner').innerHTML = '';
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (opts.immediate || reduced) finish();
  else setTimeout(finish, 220);

  if (typeof onClose === 'function') onClose();
  if (returnFocusEl && document.contains(returnFocusEl) && typeof returnFocusEl.focus === 'function') {
    returnFocusEl.focus();
  }
}

export function isDrawerOpen(id) {
  return !!activeDrawer && (!id || activeDrawer.id === id);
}

export function refreshDrawerBody(render) {
  const body = document.getElementById('cat-drawer-body');
  if (!body) return;
  render(body);
}
