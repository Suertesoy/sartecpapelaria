/* ======================================================
   SARTEC — Consentimento + carregamento de GA4 e PostHog
   Carregado de forma SÍNCRONA no início do <head> de todas as páginas,
   antes de qualquer tag.

   Modelo: Google Consent Mode v2 "básico".
   - Tudo começa negado (analytics_storage, ad_storage, ad_user_data, ad_personalization).
   - gtag.js (GA4) e PostHog NÃO são baixados antes de a pessoa aceitar a medição.
   - Recusar/revogar: consentimento volta a "denied", GA4 é desligado
     (ga-disable), PostHog faz opt-out e os cookies/armazenamento de
     medição são apagados.

   PostHog:
   - Só liga com token configurado E em domínio de produção
     (dados de teste nunca vão para o projeto de produção).
   - Sem autocapture, sem rage/dead clicks, sem heatmaps, sem exceções
     automáticas, sem gravação de sessão (até validarmos o mascaramento).
   - Lista fechada de eventos e propriedades; before_send descarta todo
     o resto e limpa URLs (query string só com parâmetros de campanha).
   ====================================================== */
(function () {
  'use strict';

  var CONFIG = {
    GA4_ID: 'G-S5M2P2DX7L',
    // Token PÚBLICO (só escrita) do projeto PostHog "Sartec | Site e Conversão" (ID 772946, US Cloud).
    // Feito para ficar no código do site. Vazio = PostHog desligado (chave de emergência).
    POSTHOG_KEY: 'phc_yVZgktfxBtXZyMEsvBW6XBvJTtQQbSShE8TRmmsRmxeq',
    POSTHOG_HOST: 'https://us.i.posthog.com',
    PROD_HOSTS: ['sartecpapelaria.com.br', 'www.sartecpapelaria.com.br'],
    // Gravação de sessão fica DESLIGADA até o mascaramento ser validado em staging.
    REPLAY_ENABLED: false,
    STORAGE_KEY: 'sartec_consent',
    VALIDADE_MS: 365 * 24 * 60 * 60 * 1000, // pergunta de novo após 12 meses
  };

  // Gancho só para testes automatizados: vale apenas em localhost.
  var ehLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (ehLocal && window.SARTEC_ANALYTICS_TEST && typeof window.SARTEC_ANALYTICS_TEST === 'object') {
    var t = window.SARTEC_ANALYTICS_TEST;
    ['POSTHOG_KEY', 'POSTHOG_HOST', 'PROD_HOSTS', 'REPLAY_ENABLED'].forEach(function (k) {
      if (k in t) CONFIG[k] = t[k];
    });
  }

  /* ---------------- Texto livre fora da URL ----------------
     O GA4 lê o endereço da página (page_location, referrer, pesquisa no site). A busca digitada
     no catálogo (?q=) é texto livre e pode conter nome, telefone ou e-mail: sai da URL ANTES de
     qualquer tag rodar. O termo fica só no histórico do navegador (history.state), de onde o
     catálogo o lê. Parâmetros de campanha (utm_*, gclid, gbraid, wbraid) não são tocados. */
  try {
    var urlAtual = new URL(location.href);
    if (urlAtual.searchParams.has('q')) {
      var buscaInicial = urlAtual.searchParams.get('q');
      urlAtual.searchParams.delete('q');
      var estadoHist = history.state && typeof history.state === 'object' ? history.state : {};
      history.replaceState(Object.assign({}, estadoHist, { buscaInicial: buscaInicial }), '',
        urlAtual.pathname + urlAtual.search + urlAtual.hash);
    }
  } catch (_) { /* navegador sem URL/history: segue sem mexer */ }

  /* ---------------- Estado do consentimento ---------------- */

  function lerEscolha() {
    try {
      var raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || c.v !== 1 || typeof c.ts !== 'number') return null;
      if (Date.now() - c.ts > CONFIG.VALIDADE_MS) return null;
      return { analytics: !!c.analytics, marketing: !!c.marketing, ts: c.ts };
    } catch (_) { return null; }
  }

  function gravarEscolha(e) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ v: 1, analytics: !!e.analytics, marketing: !!e.marketing, ts: Date.now() }));
    } catch (_) { /* modo privado sem storage: vale só nesta página */ }
  }

  var escolha = lerEscolha();
  var atual = { analytics: !!(escolha && escolha.analytics), marketing: !!(escolha && escolha.marketing) };

  function estadoGoogle(e) {
    var ads = e.marketing ? 'granted' : 'denied';
    return {
      analytics_storage: e.analytics ? 'granted' : 'denied',
      ad_storage: ads,
      ad_user_data: ads,
      ad_personalization: ads,
    };
  }

  /* ---------------- Google tag (GA4) — Consent Mode v2 básico ---------------- */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Padrão ANTES de qualquer tag: tudo negado (ou a escolha já salva).
  gtag('consent', 'default', estadoGoogle(atual));
  gtag('set', 'ads_data_redaction', true);

  var gaCarregado = false;
  function ligarGA4() {
    // GA4_ID vazio = GA4 desligado por completo (chave de emergência: ver README, "Recuperação").
    if (!CONFIG.GA4_ID) return;
    window['ga-disable-' + CONFIG.GA4_ID] = false;
    if (gaCarregado) return;
    gaCarregado = true;
    gtag('js', new Date());
    gtag('config', CONFIG.GA4_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.GA4_ID;
    (document.head || document.documentElement).appendChild(s);
  }

  // PROTEÇÃO DE DADOS PESSOAIS NO GA4:
  // a "medição otimizada" do GA4 (cliques de saída) envia link_url com o href COMPLETO do link clicado.
  // Nos links do WhatsApp, o ?text= carrega a mensagem montada pela pessoa (nome, WhatsApp, nome da
  // criança, escola, observações). Durante o despacho do clique, o href fica sem a query; ele é
  // restaurado no fim do despacho (window, fase de bolha), antes da ação padrão: o WhatsApp abre com a
  // mensagem completa e as ferramentas de medição só veem https://wa.me/<número>.
  // Correção definitiva recomendada no painel do GA4 (ver README): redigir o parâmetro "text".
  var hrefsOcultos = [];
  function linkComDados(a) {
    var h = a && a.getAttribute && a.getAttribute('href');
    return h && /^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(h) && h.indexOf('?') !== -1 ? h : null;
  }
  ['click', 'auxclick', 'contextmenu'].forEach(function (tipo) {
    window.addEventListener(tipo, function (ev) {
      if (!gaCarregado || window['ga-disable-' + CONFIG.GA4_ID]) return; // sem GA4 ativo, não mexe no link
      var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
      var h = linkComDados(a);
      if (!h) return;
      hrefsOcultos.push([a, h]);
      a.setAttribute('href', h.split('?')[0]);
    }, true);
    window.addEventListener(tipo, restaurarHrefs, false);
  });
  function restaurarHrefs() {
    while (hrefsOcultos.length) {
      var par = hrefsOcultos.pop();
      if (par[0].getAttribute('href') === par[1].split('?')[0]) par[0].setAttribute('href', par[1]);
    }
  }

  function desligarGA4() {
    window['ga-disable-' + CONFIG.GA4_ID] = true;
    apagarCookies(/^(_ga|_gid|_gat|_gcl_)/);
  }

  function apagarCookies(padrao) {
    var nomes = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); });
    var host = location.hostname;
    var dominios = ['', host, '.' + host];
    var partes = host.split('.');
    if (partes.length > 2) dominios.push('.' + partes.slice(-3).join('.'), '.' + partes.slice(-2).join('.'));
    nomes.forEach(function (n) {
      if (!padrao.test(n)) return;
      dominios.forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  /* ---------------- PostHog ---------------- */

  // Eventos aceitos e as ÚNICAS propriedades que cada um pode levar.
  // Nada de nomes, telefones, nomes de arquivo, conteúdo de lista, IDs de item da lista escolar etc.
  var EVENTOS = {
    whatsapp_click: ['event_label'],
    school_list_upload_file_selected: ['file_count', 'added_count'],
    school_list_form_attempt: [],
    school_list_form_error: ['reason'],
    school_list_analysis_started: ['file_count'],
    school_list_analysis_completed: ['item_count'],
    school_list_analysis_failed: ['error_type', 'file_count'],
    school_list_item_toggle: ['action'],
    school_list_item_preference_change: ['action', 'list_number'],
    school_list_budget_preference_change: ['preference', 'list_number'],
    school_list_continue_to_send: ['items_included'],
    school_list_send_blocked: ['reason'],
    school_list_submit_whatsapp: ['lists_count', 'items_included', 'items_excluded', 'items_total'],
    school_list_success_view: ['lists_count', 'items_included'],
    school_list_restart: [],
    school_list_restore: ['lists_count', 'has_draft'],
    // Busca: nunca o termo digitado (texto livre), só tamanho e quantidade de resultados.
    catalog_search: ['search_term_length', 'result_count'],
    catalog_search_no_result: ['search_term_length'],
    catalog_product_view: ['item_id', 'category_id'],
    catalog_item_quick_add: ['item_id', 'category_id', 'source'],
    item_custom_add: ['item_id', 'category_id', 'source'],
    manual_item_add: ['source', 'category_id'],
    quote_review_start: ['list_item_count', 'total_quantity'],
    quote_whatsapp_click: ['list_item_count', 'total_quantity', 'manual_item', 'client_type'],
  };
  // Eventos automáticos do SDK que aceitamos (o resto — $autocapture, $rageclick, $exception,
  // $snapshot, heatmaps, web vitals... — é descartado no before_send).
  var EVENTOS_SDK = { $pageview: 1, $pageleave: 1, $opt_in: 1 };
  if (CONFIG.REPLAY_ENABLED) EVENTOS_SDK.$snapshot = 1;

  // Parâmetros de URL que podem seguir para o PostHog: campanha + navegação do catálogo.
  // "q" (busca digitada) e qualquer outro parâmetro são removidos.
  var PARAMS_URL_OK = /^(utm_(source|medium|campaign|term|content|id)|gclid|gbraid|wbraid|gad_source|gad_campaignid|categoria|subcategoria)$/;

  function limparUrl(valor) {
    if (typeof valor !== 'string' || !/^https?:\/\//i.test(valor)) return valor; // ex.: "$direct"
    try {
      var u = new URL(valor);
      var manter = new URLSearchParams();
      u.searchParams.forEach(function (v, k) { if (PARAMS_URL_OK.test(k)) manter.append(k, v.slice(0, 100)); });
      var qs = manter.toString();
      return u.origin + u.pathname + (qs ? '?' + qs : '');
    } catch (_) { return null; }
  }

  function limparObjetoUrls(obj) {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(function (k) {
      if (typeof obj[k] === 'string' && /url|referrer|href/i.test(k)) obj[k] = limparUrl(obj[k]);
    });
  }

  function beforeSend(ev) {
    if (!ev || !ev.event) return null;
    if (!EVENTOS[ev.event] && !EVENTOS_SDK[ev.event]) return null;
    var p = ev.properties || {};
    ['$elements', '$elements_chain', '$el_text', '$element_text'].forEach(function (k) { delete p[k]; });
    limparObjetoUrls(p);
    limparObjetoUrls(p.$set);
    limparObjetoUrls(p.$set_once);
    limparObjetoUrls(ev.$set);
    limparObjetoUrls(ev.$set_once);
    [p.$set_once, ev.$set_once, p.$set, ev.$set].forEach(function (o) {
      var info = o && o.$initial_person_info;
      if (info && typeof info === 'object') {
        if (typeof info.u === 'string') info.u = limparUrl(info.u);
        if (typeof info.r === 'string') info.r = limparUrl(info.r);
      }
    });
    return ev;
  }

  function valorSeguro(v) {
    if (typeof v === 'number') return isFinite(v) ? v : undefined;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string' && /^[A-Za-z0-9_\-]{1,60}$/.test(v)) return v;
    return undefined; // texto livre, objetos, nomes etc. nunca seguem
  }

  var phAtivo = false;     // init feito nesta página
  var phCarregado = false;

  function posthogPermitido() {
    return !!CONFIG.POSTHOG_KEY && CONFIG.PROD_HOSTS.indexOf(location.hostname) !== -1;
  }

  function opcoesPostHog() {
    return {
      api_host: CONFIG.POSTHOG_HOST,
      opt_out_capturing_by_default: true,
      person_profiles: 'identified_only', // nunca chamamos identify: sem perfis de pessoa
      autocapture: false,
      capture_pageview: true,              // site multipágina: 1 $pageview por carregamento
      capture_pageleave: true,
      rageclick: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      enable_heatmaps: false,
      capture_exceptions: false,
      capture_performance: false,
      disable_surveys: true,
      advanced_disable_flags: true,
      disable_session_recording: !CONFIG.REPLAY_ENABLED,
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        blockSelector: '.ph-no-capture, [data-ph-block], input[type="file"], img[src^="blob:"], .cat-drawer',
        recordHeaders: false,
        recordBody: false,
      },
      before_send: beforeSend,
      loaded: function (ph) {
        ph.opt_in_capturing({ captureEventName: false });
      },
    };
  }

  function carregarSnippetPostHog() {
    /* Snippet oficial (posthog.com/docs/libraries/js) — cria o stub e baixa array.js */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  }

  function ligarPostHog() {
    if (!posthogPermitido()) return;
    if (!phCarregado) {
      phCarregado = true;
      carregarSnippetPostHog();
      window.posthog.init(CONFIG.POSTHOG_KEY, opcoesPostHog());
    } else {
      window.posthog.opt_in_capturing({ captureEventName: false });
    }
    phAtivo = true;
  }

  function desligarPostHog() {
    phAtivo = false;
    pendenteBusca = null;
    clearTimeout(timerBusca);
    if (phCarregado && window.posthog) {
      try { window.posthog.opt_out_capturing(); } catch (_) {}
      try { window.posthog.reset(); } catch (_) {} // descarta distinct_id e propriedades salvas
    }
    // Remove identificadores persistidos (mantém só a marca de opt-out do SDK, sem ID).
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (/^ph_.*_posthog$/.test(k)) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(function (k) {
        if (/^ph_/.test(k)) sessionStorage.removeItem(k);
      });
    } catch (_) {}
    apagarCookies(/^ph_.*_posthog$/);
  }

  // Busca do catálogo dispara a cada pausa de digitação (e em re-render). No PostHog
  // mandamos só a busca final: espera 1,5 s sem nova busca e ignora repetição da mesma busca.
  // O termo (opcoes.chaveBusca) serve só para essa comparação, em memória: nunca é enviado.
  var pendenteBusca = null;
  var timerBusca = null;
  var ultimaChaveEnviada = null;

  function enviarBuscaPendente(transporte) {
    clearTimeout(timerBusca);
    var b = pendenteBusca;
    pendenteBusca = null;
    if (!b || !phAtivo) return;
    if (b.chave === ultimaChaveEnviada) return;
    ultimaChaveEnviada = b.chave;
    var opts = transporte ? { transport: transporte } : undefined;
    window.posthog.capture('catalog_search', { search_term_length: b.tamanho, result_count: b.resultados, page_path: location.pathname }, opts);
    if (b.resultados === 0) {
      window.posthog.capture('catalog_search_no_result', { search_term_length: b.tamanho, page_path: location.pathname }, opts);
    }
  }

  window.addEventListener('pagehide', function () { enviarBuscaPendente('sendBeacon'); });

  function capturar(nome, params, opcoes) {
    if (!phAtivo || !window.posthog) return;
    var permitidas = EVENTOS[nome];
    if (!permitidas) return;
    params = params || {};
    opcoes = opcoes || {};
    if (nome === 'whatsapp_click' && opcoes.bloqueado) return; // clique impedido pela validação

    if (nome === 'catalog_search_no_result') return; // derivado de result_count na busca final
    if (nome === 'catalog_search') {
      var chave = String(opcoes.chaveBusca || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!chave) return;
      pendenteBusca = {
        chave: chave,
        tamanho: valorSeguro(params.search_term_length) || 0,
        resultados: valorSeguro(params.result_count),
      };
      clearTimeout(timerBusca);
      timerBusca = setTimeout(enviarBuscaPendente, 1500);
      return;
    }

    var props = { page_path: location.pathname, viewport: window.innerWidth < 768 ? 'mobile' : 'desktop' };
    permitidas.forEach(function (k) {
      var v = valorSeguro(params[k]);
      if (v !== undefined) props[k] = v;
    });
    window.posthog.capture(nome, props);
  }

  /* ---------------- Aplicar escolha ---------------- */

  var ouvintes = [];

  function aplicar(e) {
    atual = { analytics: !!e.analytics, marketing: !!e.marketing };
    gtag('consent', 'update', estadoGoogle(atual));
    if (atual.analytics) { ligarGA4(); ligarPostHog(); }
    else { desligarGA4(); desligarPostHog(); }
    if (!atual.marketing) apagarCookies(/^_gcl_/);
    ouvintes.forEach(function (fn) { try { fn(atual); } catch (_) {} });
  }

  function salvar(e) {
    gravarEscolha(e);
    aplicar(e);
    fecharBanner();
  }

  if (escolha && escolha.analytics) { ligarGA4(); ligarPostHog(); }

  /* ---------------- Banner ---------------- */

  var banner = null;
  var abertoPorRodape = false;
  var focoAnterior = null;

  function htmlBanner() {
    return '' +
      '<div class="consent-card" role="dialog" aria-modal="false" aria-labelledby="consent-titulo" aria-describedby="consent-texto">' +
        '<p class="consent-titulo" id="consent-titulo">Sua privacidade</p>' +
        '<p class="consent-texto" id="consent-texto">Com sua autorização, usamos cookies e ferramentas de medição (Google Analytics e PostHog) para entender como o site é usado e melhorar a experiência, e medimos resultados de anúncios do Google. Nada disso é ativado antes da sua escolha. O que você digita ou envia na lista escolar não é repassado a essas ferramentas.</p>' +
        '<div class="consent-opcoes" id="consent-opcoes" hidden>' +
          '<label class="consent-opcao consent-opcao-fixa"><input type="checkbox" checked disabled> <span><strong>Essenciais</strong> — sempre ativos. Guardam no seu aparelho o progresso da lista escolar e esta escolha.</span></label>' +
          '<label class="consent-opcao"><input type="checkbox" id="consent-analytics"> <span><strong>Medição e melhoria do site</strong> — Google Analytics e PostHog: páginas visitadas e uso das ferramentas, sem seus dados pessoais.</span></label>' +
          '<label class="consent-opcao"><input type="checkbox" id="consent-marketing"> <span><strong>Publicidade</strong> — permite ao Google medir os resultados de anúncios.</span></label>' +
        '</div>' +
        '<div class="consent-acoes">' +
          '<button type="button" class="consent-btn" data-consent="recusar">Recusar</button>' +
          '<button type="button" class="consent-btn" data-consent="aceitar">Aceitar</button>' +
          '<button type="button" class="consent-link" data-consent="personalizar" aria-expanded="false" aria-controls="consent-opcoes">Personalizar</button>' +
          '<button type="button" class="consent-btn consent-btn-salvar" data-consent="salvar" hidden>Salvar escolhas</button>' +
        '</div>' +
      '</div>';
  }

  function mostrarOpcoes(mostrar) {
    if (!banner) return;
    banner.querySelector('#consent-opcoes').hidden = !mostrar;
    banner.querySelector('[data-consent="salvar"]').hidden = !mostrar;
    var p = banner.querySelector('[data-consent="personalizar"]');
    p.hidden = mostrar;
    p.setAttribute('aria-expanded', String(mostrar));
    if (mostrar) {
      banner.querySelector('#consent-analytics').checked = atual.analytics;
      banner.querySelector('#consent-marketing').checked = atual.marketing;
    }
  }

  function abrirBanner(comOpcoes) {
    if (!document.body) return;
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'consent-banner';
      banner.id = 'consent-banner';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Preferências de privacidade');
      banner.innerHTML = htmlBanner();
      banner.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-consent]');
        if (!b) return;
        var acao = b.getAttribute('data-consent');
        if (acao === 'aceitar') salvar({ analytics: true, marketing: true });
        else if (acao === 'recusar') salvar({ analytics: false, marketing: false });
        else if (acao === 'personalizar') { mostrarOpcoes(true); banner.querySelector('#consent-analytics').focus(); }
        else if (acao === 'salvar') salvar({
          analytics: banner.querySelector('#consent-analytics').checked,
          marketing: banner.querySelector('#consent-marketing').checked,
        });
      });
      banner.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && abertoPorRodape) fecharBanner();
      });
      document.body.appendChild(banner);
    }
    mostrarOpcoes(!!comOpcoes);
    banner.hidden = false;
    document.body.classList.add('consent-aberto');
  }

  function fecharBanner() {
    if (!banner) return;
    banner.hidden = true;
    document.body.classList.remove('consent-aberto');
    if (abertoPorRodape && focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    abertoPorRodape = false;
    focoAnterior = null;
  }

  function abrirPreferencias() {
    abertoPorRodape = true;
    focoAnterior = document.activeElement;
    abrirBanner(true);
    banner.querySelector('#consent-analytics').focus();
  }

  // Qualquer elemento com data-abrir-privacidade (ex.: link no rodapé) reabre as preferências.
  document.addEventListener('click', function (ev) {
    var alvo = ev.target.closest && ev.target.closest('[data-abrir-privacidade]');
    if (!alvo) return;
    ev.preventDefault();
    abrirPreferencias();
  });

  function iniciarBanner() { if (!lerEscolha()) abrirBanner(false); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarBanner);
  else iniciarBanner();

  /* ---------------- API pública ---------------- */

  window.SartecConsent = {
    analyticsPermitido: function () { return atual.analytics; },
    marketingPermitido: function () { return atual.marketing; },
    escolhaFeita: function () { return !!lerEscolha(); },
    capturar: capturar,
    abrirPreferencias: abrirPreferencias,
    aceitarTudo: function () { salvar({ analytics: true, marketing: true }); },
    recusarTudo: function () { salvar({ analytics: false, marketing: false }); },
    aoMudar: function (fn) { if (typeof fn === 'function') ouvintes.push(fn); },
    // Exposto para testes de privacidade (funções puras, sem efeito colateral).
    _limparUrl: limparUrl,
    _beforeSend: beforeSend,
  };
})();
