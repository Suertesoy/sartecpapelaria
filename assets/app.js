/* ======================================================
   SARTEC — JS comum (header, footer, FAB)
   Site sempre em light mode — dark mode removido.
   ====================================================== */

window.SARTEC = {
  WPP_PRINCIPAL: '5512981594959',
  WPP_COPIAS:    '551239341666',
  ENDERECO: 'Av. Andrômeda, 1805 — Jardim Satélite, São José dos Campos/SP',
  CEP: '12230-000',
  CNPJ: '06.241.041/0001-56',
  HORARIO:  'Seg a Sex: 8h30 às 18h30 • Sáb: 9h às 14h',
  TELEFONE_DISPLAY: '(12) 98159-4959',
  EMAIL: 'sartecpapelaria@uol.com.br'
};

function montarWpp(numero, mensagem) {
  const texto = mensagem ? '?text=' + encodeURIComponent(mensagem) : '';
  return `https://wa.me/${numero}${texto}`;
}

/* =========================================================
   HEADER
   ========================================================= */
let _menuListenersAdded = false;

function renderHeader(active) {
  const lk = (slug) => active === slug ? 'class="active"' : '';
  const wppSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

  const html = `
    <header class="site-header">
      <div class="container">
        <a href="index.html" class="brand">
          <img src="assets/logo-sartec-header.png" alt="Sartec Papelaria" />
        </a>
        <nav class="main-nav" id="main-nav">
          <a href="index.html" ${lk('home')}>Início</a>
          <a href="produtos.html" ${lk('produtos')}>Produtos</a>
          <a href="lista-escolar.html" ${lk('lista')}>Lista Escolar</a>
          <a href="empresas.html" ${lk('empresas')}>Empresas</a>
          <a href="escolas.html" ${lk('escolas')}>Escolas Parceiras</a>
          <a href="copias.html" ${lk('copias')}>Cópias e Impressão</a>
        </nav>
        <div class="header-actions">
          <a href="${montarWpp(SARTEC.WPP_PRINCIPAL, 'Olá! Vim pelo site da Sartec.')}"
             target="_blank" rel="noopener" class="btn-wpp-header">
            ${wppSVG}<span>WhatsApp</span>
          </a>
          <button class="menu-toggle" id="menu-toggle" onclick="toggleMenu()" aria-label="Menu">
            <svg width="22" height="27" viewBox="0 0 24 29" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
              <polyline points="9,22 12,26 15,22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `;
  document.getElementById('header-mount')?.insertAdjacentHTML('afterbegin', html);

  document.querySelectorAll('#main-nav a').forEach(a =>
    a.addEventListener('click', closeMenu)
  );

  if (!_menuListenersAdded) {
    document.addEventListener('click', e => {
      if (!document.querySelector('.site-header')?.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });
    _menuListenersAdded = true;
  }
}

function closeMenu() {
  document.getElementById('main-nav')?.classList.remove('open');
}

function toggleMenu() {
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.toggle('open');
}

/* =========================================================
   FAIXA ENTREGA GRÁTIS (MARQUEE — home, após hero)
   ========================================================= */
function renderDeliveryFaixa() {
  const mount = document.getElementById('delivery-faixa-mount');
  if (!mount) return;

  const wpp = 'https://wa.me/5512981594959?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20Sartec%20e%20quero%20fazer%20um%20pedido.';

  const msg = 'Entrega grátis acima de R$ 100,00 em São José dos Campos';
  const items = [
    { ico: '🚚', texto: msg },
    { ico: '🚚', texto: msg },
    { ico: '🚚', texto: msg },
    { ico: '🚚', texto: msg },
    { ico: '🚚', texto: msg },
  ];

  const pills = items.map(i => `
    <a href="${wpp}" target="_blank" rel="noopener" class="escola-pill" tabindex="-1" aria-hidden="true">
      <span class="badge">${i.ico}</span>
      <span>${i.texto}</span>
    </a>
  `).join('');

  mount.innerHTML = `
    <a href="${wpp}" target="_blank" rel="noopener" class="escolas-faixa-link" aria-label="Entrega grátis em São José dos Campos para compras acima de R$ 100">
      <div class="escolas-faixa">
        <div class="faixa-track">
          ${pills}${pills}${pills}${pills}
        </div>
      </div>
    </a>
  `;
}

/* =========================================================
   FAIXA DE PARCERIA COM ESCOLAS (MARQUEE)
   ========================================================= */
function renderEscolasFaixa() {
  const mount = document.getElementById('escolas-faixa-mount');
  if (!mount) return;

  const items = [
    { ico: '🏫', texto: 'Seja uma escola parceira' },
    { ico: '✨', texto: 'Veja condições e benefícios' },
    { ico: '🏫', texto: 'Sua escola pode ser parceira' },
    { ico: '📋', texto: 'Entenda como indicar a Sartec' },
  ];

  const pills = items.map(i => `
    <a href="escolas.html" class="escola-pill" tabindex="-1" aria-hidden="true">
      <span class="badge">${i.ico}</span>
      <span>${i.texto}</span>
    </a>
  `).join('');

  mount.innerHTML = `
    <a href="escolas.html" class="escolas-faixa-link" aria-label="Saiba mais sobre parceria com escolas">
      <div class="escolas-faixa">
        <div class="faixa-track">
          ${pills}${pills}${pills}${pills}
        </div>
      </div>
    </a>
  `;
}

/* =========================================================
   FOOTER
   ========================================================= */
function renderFooter() {
  const html = `
    <footer class="site-footer">
      <div class="footer-accent-bar"></div>
      <div class="container footer-container">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="footer-logo-seal">
              <img src="assets/logo-sartec.png" alt="Sartec Papelaria" />
            </div>
            <p>Papelaria, informática, cópias e impressão. Atendimento personalizado e tudo organizado pra você.</p>
          </div>
          <div class="footer-col">
            <h4>Navegação</h4>
            <a href="index.html">Início</a>
            <a href="produtos.html">Produtos</a>
            <a href="lista-escolar.html">Lista Escolar</a>
            <a href="copias.html">Cópias e Impressão</a>
            <a href="empresas.html">Empresas</a>
            <a href="escolas.html">Escolas Parceiras</a>
          </div>
          <div class="footer-col">
            <h4>Loja e contato</h4>
            <p>${SARTEC.ENDERECO}</p>
            <p>CEP: ${SARTEC.CEP}</p>
            <p>${SARTEC.HORARIO}</p>
            <p>${SARTEC.TELEFONE_DISPLAY}</p>
            <p>${SARTEC.EMAIL}</p>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container footer-bottom-inner">
          <span>© 2026 Sartec Papelaria e Informática &nbsp;·&nbsp; CNPJ: ${SARTEC.CNPJ}</span>
          <span>Implementado pela <a href="https://sartec-digital.vercel.app/" target="_blank" rel="noopener" class="footer-digital-link">Sartec Digital</a></span>
          <span class="footer-ai-note">Algumas imagens deste site foram geradas ou editadas com inteligência artificial para fins ilustrativos.</span>
        </div>
      </div>
    </footer>
  `;
  document.getElementById('footer-mount')?.insertAdjacentHTML('beforeend', html);
}

/* =========================================================
   FAB
   ========================================================= */
function renderFab(modo) {
  const isCopias = modo === 'copias';
  const numero = isCopias ? SARTEC.WPP_COPIAS : SARTEC.WPP_PRINCIPAL;
  const msg = isCopias
    ? 'Olá! Vim pelo site da Sartec e quero falar com o setor de cópias e impressão.'
    : 'Olá! Vim pelo site da Sartec.';
  const cls = isCopias ? 'fab-wpp copias' : 'fab-wpp';
  const label = isCopias ? 'WhatsApp Cópias' : 'Falar no WhatsApp';
  const html = `
    <a href="${montarWpp(numero, msg)}" target="_blank" rel="noopener" class="${cls}" aria-label="${label}">
      <svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      <span class="label">${label}</span>
    </a>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

/* =========================================================
   PAGE TRANSITIONS (page-transition)
   ========================================================= */
function initPageTransitions() {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      document.body.classList.remove('is-leaving');
    }
  });

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    const target = anchor.getAttribute('target');

    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    if (!href || 
        target === '_blank' || 
        e.defaultPrevented ||
        href.startsWith('#') || 
        href.startsWith('mailto:') || 
        href.startsWith('tel:') || 
        href.startsWith('javascript:') || 
        href.includes('wa.me') ||
        (href.includes('//') && !href.includes(window.location.host))) {
      return;
    }

    e.preventDefault();
    document.body.classList.add('is-leaving');

    setTimeout(() => {
      window.location.href = href;
    }, 150);
  });
}

/* =========================================================
   HOME — ANIMATED LIST PREVIEW
   ========================================================= */
function initHomeListPreview() {
  const panel = document.getElementById('home-list-preview');
  if (!panel) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const qty0      = document.getElementById('hlp-qty-0');
  const qty2      = document.getElementById('hlp-qty-2');
  const pref1     = document.getElementById('hlp-pref-1');
  const inc3      = document.getElementById('hlp-inc-3');
  const exc3      = document.getElementById('hlp-exc-3');
  const card3     = document.getElementById('hlpc-3');
  const counter   = document.getElementById('hlp-footer-count');
  const wppBtn    = document.getElementById('hlp-wpp-btn');
  const popup     = document.getElementById('hlp-popup');
  const popupSend = document.getElementById('hlp-popup-send');
  const allCards  = panel.querySelectorAll('.hlp-card');

  function clearActive() { allCards.forEach(c => c.classList.remove('hlp-is-active')); }
  function activate(id)  { clearActive(); const c = document.getElementById(id); if (c) c.classList.add('hlp-is-active'); }

  function clickFx(el, cb) {
    if (el) {
      el.classList.add('hlp-clicking');
      setTimeout(() => el.classList.remove('hlp-clicking'), 200);
    }
    setTimeout(cb, 220);
  }

  function stepQty(el, target, gap, cb) {
    if (!el) { if (cb) cb(); return; }
    const current = parseInt(el.textContent, 10);
    if (current === target) { if (cb) cb(); return; }
    const dir  = target > current ? 1 : -1;
    const wrap = el.closest('.hlp-qty');
    const btns = wrap ? wrap.querySelectorAll('.hlp-qty-btn') : [];
    const btn  = btns.length ? (dir > 0 ? btns[btns.length - 1] : btns[0]) : null;
    clickFx(btn, () => {
      el.textContent = String(current + dir);
      setTimeout(() => stepQty(el, target, gap, cb), gap);
    });
  }

  function typeText(el, text, cb) {
    if (!el) { if (cb) cb(); return; }
    el.style.transition = 'max-height .3s ease, opacity .3s ease, margin-top .3s ease';
    el.style.maxHeight  = '22px';
    el.style.opacity    = '1';
    el.style.marginTop  = '4px';
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(iv); if (cb) setTimeout(cb, 400); }
    }, 72);
  }

  function hidePref(el) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.maxHeight  = '0';
    el.style.opacity    = '0';
    el.style.marginTop  = '0';
    el.textContent      = '';
  }

  function reset() {
    clearActive();
    if (qty0)    qty0.textContent = '4';
    if (qty2)    qty2.textContent = '8';
    hidePref(pref1);
    if (card3)   card3.classList.remove('hlp-excluido');
    if (inc3)    inc3.classList.add('hlp-ativo');
    if (exc3)    exc3.classList.remove('hlp-ativo');
    if (counter) counter.textContent = '4 itens para comprar';
    if (popup)   popup.classList.remove('hlp-popup-visible');
  }

  hidePref(pref1);

  function cycle() {
    reset();

    setTimeout(() => {
      // Fase 1 — Caderno: qty 4 → 8
      activate('hlpc-0');
      stepQty(qty0, 8, 380, () => {

        setTimeout(() => {
          // Fase 2 — Pasta: digitar preferência
          activate('hlpc-1');
          typeText(pref1, 'Preferência: cor vermelha opaca', () => {

            setTimeout(() => {
              // Fase 3 — Lápis: qty 8 → 2
              activate('hlpc-2');
              stepQty(qty2, 2, 320, () => {

                setTimeout(() => {
                  // Fase 4 — Borracha: toggle "Não quero"
                  activate('hlpc-3');
                  setTimeout(() => {
                    clickFx(exc3, () => {
                      if (card3)   card3.classList.add('hlp-excluido');
                      if (inc3)    inc3.classList.remove('hlp-ativo');
                      if (exc3)    exc3.classList.add('hlp-ativo');
                      if (counter) counter.textContent = '3 itens para comprar';

                      setTimeout(() => {
                        // Fase 5 — Clicar "Enviar pelo WhatsApp"
                        clearActive();
                        clickFx(wppBtn, () => {

                          setTimeout(() => {
                            // Fase 6 — Popup aparece
                            if (popup) popup.classList.add('hlp-popup-visible');

                            setTimeout(() => {
                              // Fase 7 — Clicar "Enviar" no popup
                              clickFx(popupSend, () => {
                                setTimeout(() => {
                                  if (popup) popup.classList.remove('hlp-popup-visible');
                                  setTimeout(cycle, 1800);
                                }, 350);
                              });
                            }, 2200);
                          }, 450);
                        });
                      }, 1000);
                    });
                  }, 700);
                }, 700);
              });
            }, 700);
          });
        }, 700);
      });
    }, 900);
  }

  setTimeout(cycle, 800);
}

/* =========================================================
   INIT
   ========================================================= */
window.SartecInit = function ({ active, fab }) {
  document.addEventListener('DOMContentLoaded', () => {
    renderHeader(active);
    renderDeliveryFaixa();
    renderEscolasFaixa();
    renderFooter();
    renderFab(fab || 'principal');
    initPageTransitions();
    initHomeListPreview();
  });
};
