/* ======================================================
   Teste e2e — Consentimento, GA4 e PostHog (Playwright + Chromium)

   Uso (na raiz do projeto):
     node tests/analytics-consent.e2e.mjs

   Garantias do próprio teste (nenhum dado de teste chega a produção):
   - Toda requisição externa é interceptada. Só os SCRIPTS oficiais são baixados
     (gtag.js e array.js do PostHog); hits de GA4 (/g/collect) e capturas do
     PostHog são decodificados aqui e respondidos localmente, nunca enviados.
   - PostHog usa um token fictício, aceito só em localhost via
     window.SARTEC_ANALYTICS_TEST (gancho ignorado fora de localhost).
   - /api/analisar-lista é simulada (sem IA real).
   ====================================================== */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg' };
const GA_ID = 'G-S5M2P2DX7L';
const PH_TOKEN_FALSO = 'phc_teste_local_nao_existe_000000000000000';

// Dados pessoais fictícios: NENHUM pode aparecer em hits do GA4 nem do PostHog.
const PII = {
  responsavel: 'Mariana Sigilosa',
  whatsapp: '(12) 98877-6655',
  crianca: 'Joaquim Confidencial',
  cor: 'azulmarinhounico',
  obs: 'observacaoprivadaxyz',
  marca: 'MarcaPrivadaXYZ',
  arquivo: 'lista-secreta-joaquim.png',
  escola: 'Colegio Particular Sigiloso',
};
// telefone buscado completo (formatado e só dígitos): trechos curtos colidem com timestamps e IDs aleatórios
const PII_BUSCA = [PII.responsavel, 'Sigilosa', PII.whatsapp, '98877-6655', '12988776655', '988776655', PII.crianca, 'Joaquim', PII.cor, PII.obs, PII.marca, 'lista-secreta', PII.escola, 'Sigiloso'];

const RESPOSTA_OK = {
  ok: true,
  metadados: { escola: PII.escola, anoSerie: '3º ano', segmento: 'Fundamental', anoLetivo: '2027' },
  itens: [
    { id: 'cad_universitario', nome: 'Caderno universitário 96 folhas', qty: 4, obs: 'Capa dura', unidade: 'un', categoria: 'x', marcaSugerida: 'Tilibra', confianca: 'alta' },
    { id: 'lapis_grafite', nome: 'Lápis grafite nº 2', qty: 6, obs: '', unidade: 'un', categoria: 'x', marcaSugerida: '', confianca: 'alta' },
    { id: 'tesoura', nome: 'Tesoura sem ponta', qty: 1, obs: '', unidade: 'un', categoria: 'x', marcaSugerida: '', confianca: 'alta' },
  ],
  validacaoConjunto: { mesmaCriancaProvavel: true, confianca: 'alta' },
};

// ---------- servidor estático ----------
function servir() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const arq = path.join(RAIZ, url === '/' ? 'index.html' : url);
      if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(arq)] || 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sartec-analytics-'));
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ARQ_FIXTURE = path.join(TMP, PII.arquivo);
fs.writeFileSync(ARQ_FIXTURE, Buffer.concat([PNG_1X1, Buffer.alloc(2048)]));

// ---------- mini runner ----------
const resultados = [];
async function teste(nome, fn) {
  if (process.env.SO_TESTE && !nome.startsWith(process.env.SO_TESTE)) return; // ex.: SO_TESTE=4.3
  try { await fn(); resultados.push([nome, true]); console.log('  PASS', nome); }
  catch (e) { resultados.push([nome, false, e]); console.log('  FAIL', nome, '\n       ', String(e.message || e).split('\n').slice(0, 3).join('\n        ')); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function igual(real, esperado, msg) {
  if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error(`${msg}: esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(real)}`);
}
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
async function esperar(cond, ms = 10000, msg = 'condição') {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return; await dormir(100); }
  throw new Error('timeout esperando ' + msg);
}
function contar(lista, nome) { return lista.filter(e => e.event === nome || e.en === nome).length; }

// ---------- decodificação dos envios interceptados ----------
function decodificarPH(req) {
  const buf = req.postDataBuffer();
  if (!buf || !buf.length) return [];
  try {
    let txt = (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    if (txt.startsWith('data=')) txt = Buffer.from(decodeURIComponent(txt.slice(5)), 'base64').toString('utf8');
    const j = JSON.parse(txt);
    return Array.isArray(j) ? j : (j.batch || [j]);
  } catch (e) {
    return [{ event: '__nao_decodificado', erro: String(e) }];
  }
}
function decodificarGA(req) {
  const u = new URL(req.url());
  const base = Object.fromEntries(u.searchParams);
  const linhas = (req.postData() || '').split(/\r?\n/).filter(Boolean);
  if (!linhas.length) return [base];
  return linhas.map(l => ({ ...base, ...Object.fromEntries(new URLSearchParams(l)) }));
}

// ---------- sessão ----------
async function abrir(browser, { device = null, consent = null, posthog = true } = {}) {
  // O PostHog descarta eventos de user agents com cara de robô ("HeadlessChrome"). Em vez de desligar
  // esse filtro no código de produção, o teste usa o user agent de um Chrome comum.
  const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport: { width: 1440, height: 900 }, userAgent: UA_CHROME });
  const s = { ctx, externos: [], ga: [], gaBruto: [], ph: [], phBruto: [], debug: [], erros: [], scripts: [], resposta: RESPOSTA_OK };

  await ctx.addInitScript(({ token, posthog, consent }) => {
    window.SARTEC_DEBUG_ANALYTICS = true;
    if (posthog) window.SARTEC_ANALYTICS_TEST = { POSTHOG_KEY: token, POSTHOG_HOST: 'https://us.i.posthog.com', PROD_HOSTS: ['127.0.0.1'] };
    // Escolha prévia só na 1ª carga do contexto (não sobrescreve revogação/reload)
    try {
      if (consent && !sessionStorage.getItem('__consent_preset')) {
        sessionStorage.setItem('__consent_preset', '1');
        localStorage.setItem('sartec_consent', JSON.stringify({ v: 1, analytics: consent.analytics, marketing: consent.marketing, ts: Date.now() }));
      }
    } catch (_) { /* documentos de origem opaca (about:blank de popup etc.) */ }
  }, { token: PH_TOKEN_FALSO, posthog, consent });

  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    const u = new URL(url);
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === 'sartec.test') {
      if (u.pathname === '/api/analisar-lista') {
        const r = typeof s.resposta === 'function' ? s.resposta() : s.resposta;
        if (r === 'abort') return route.abort();
        if (r && r.__status) return route.fulfill({ status: r.__status, contentType: r.__tipo || 'text/html', body: r.__corpo || '' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
      }
      return route.continue();
    }
    s.externos.push(url);
    // Scripts oficiais: podem ser baixados (não carregam dados do site)
    if (/^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/.test(url)) { s.scripts.push('gtag'); return route.continue(); }
    if (/^https:\/\/us-assets\.i\.posthog\.com\/static\/[\w.\-]+\.js/.test(url)) { s.scripts.push('posthog:' + u.pathname); return route.continue(); }
    // Envio GA4: decodifica e responde localmente
    if (/google-analytics\.com|analytics\.google\.com/.test(u.hostname) && /\/g\/collect/.test(u.pathname)) {
      s.gaBruto.push(url + '\n' + (req.postData() || ''));
      s.ga.push(...decodificarGA(req));
      return route.fulfill({ status: 204, body: '' });
    }
    // Envio PostHog: decodifica e responde localmente
    if (u.hostname === 'us.i.posthog.com') {
      const evs = decodificarPH(req);
      s.phBruto.push(url + '\n' + JSON.stringify(evs));
      s.ph.push(...evs);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    }
    if (u.hostname === 'us-assets.i.posthog.com') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    // Qualquer outra coisa (fontes, wa.me, Google Maps, doubleclick...) é bloqueada
    return route.abort();
  });

  ctx.on('page', (p) => {
    p.on('console', async (msg) => {
      if (msg.type() !== 'debug') return;
      const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => null)));
      if (args[0] === '[Sartec Analytics]') s.debug.push({ nome: args[1], dados: args[2] });
    });
    p.on('pageerror', e => s.erros.push(String(e)));
  });
  s.page = await ctx.newPage();
  return s;
}

const externosDeMedicao = (s) => s.externos.filter(u => /googletagmanager|google-analytics|analytics\.google|doubleclick|googleadservices|posthog/.test(u));
const bannerVisivel = (page) => page.locator('#consent-banner').isVisible().catch(() => false);
const nomesPH = (s) => s.ph.map(e => e.event);

async function irPara(s, base, pagina, { esperarBanner = null } = {}) {
  await s.page.goto(`${base}/${pagina}`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForLoadState('load').catch(() => {});
  if (esperarBanner === true) await s.page.waitForSelector('#consent-banner:not([hidden])', { timeout: 5000 });
}

async function estadoArmazenado(page) {
  return page.evaluate(() => ({
    cookies: document.cookie,
    ls: Object.keys(localStorage),
    gaDisable: window['ga-disable-G-S5M2P2DX7L'],
    gtagScripts: document.querySelectorAll('script[src*="googletagmanager"]').length,
    phScripts: document.querySelectorAll('script[src*="posthog"]').length,
    dlEventos: (window.dataLayer || []).filter(a => a && a[0] === 'event').length,
    consent: localStorage.getItem('sartec_consent'),
  }));
}

// =====================================================================
async function rodar() {
  const srv = await servir();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const baseNaoLocal = `http://sartec.test:${srv.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: [`--host-resolver-rules=MAP sartec.test 127.0.0.1`, `--disable-blink-features=AutomationControlled`] })
    .catch(() => chromium.launch({ args: [`--host-resolver-rules=MAP sartec.test 127.0.0.1`, `--disable-blink-features=AutomationControlled`] }));

  console.log('\n# 1. Antes do consentimento');
  await teste('1.1 nenhuma tag de medição carrega nem envia antes da escolha (home, produtos, lista)', async () => {
    const s = await abrir(browser);
    for (const pg of ['index.html', 'produtos.html', 'lista-escolar.html']) {
      await irPara(s, base, pg, { esperarBanner: true });
      await s.page.mouse.wheel(0, 2500);
      await dormir(400);
    }
    // interações que disparam trackEvent
    await irPara(s, base, 'produtos.html', { esperarBanner: true });
    await s.page.fill('#cat-search-input', 'caderno');
    await dormir(800);
    await dormir(3000);
    const st = await estadoArmazenado(s.page);
    igual(externosDeMedicao(s), [], 'requisições de medição antes do consentimento');
    igual(st.gtagScripts + st.phScripts, 0, 'scripts de medição no DOM');
    igual(st.dlEventos, 0, 'eventos enfileirados no dataLayer');
    ok(!/_ga|ph_/.test(st.cookies), 'cookies de medição: ' + st.cookies);
    ok(!st.ls.some(k => k.startsWith('ph_')), 'storage do PostHog: ' + st.ls);
    ok(s.debug.some(d => d.nome === 'catalog_search'), 'trackEvent continua funcionando (debug)');
    const defaults = await s.page.evaluate(() => (window.dataLayer || []).filter(a => a[0] === 'consent').map(a => [a[1], a[2]]));
    igual(defaults[0], ['default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }], 'Consent Mode v2 default');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('1.2 banner: Aceitar e Recusar com o mesmo peso; Personalizar abre categorias', async () => {
    const s = await abrir(browser);
    await irPara(s, base, 'index.html', { esperarBanner: true });
    const estilos = await s.page.evaluate(() => ['aceitar', 'recusar'].map(a => {
      const el = document.querySelector(`[data-consent="${a}"]`);
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, cor: cs.color, peso: cs.fontWeight, w: Math.round(r.width), h: Math.round(r.height) };
    }));
    igual(estilos[0], estilos[1], 'Aceitar x Recusar');
    ok(estilos[0].h >= 44, 'altura mínima de toque');
    ok(await s.page.locator('#consent-opcoes').isHidden(), 'opções fechadas de início');
    await s.page.click('[data-consent="personalizar"]');
    ok(await s.page.locator('#consent-opcoes').isVisible(), 'opções visíveis');
    igual(await s.page.locator('#consent-analytics').isChecked(), false, 'medição desmarcada por padrão');
    igual(await s.page.locator('#consent-marketing').isChecked(), false, 'publicidade desmarcada por padrão');
    await s.ctx.close();
  });

  console.log('\n# 2. Recusa');
  await teste('2.1 recusar: nada carrega, escolha lembrada, banner não volta', async () => {
    const s = await abrir(browser);
    await irPara(s, base, 'produtos.html', { esperarBanner: true });
    await s.page.click('[data-consent="recusar"]');
    ok(!(await bannerVisivel(s.page)), 'banner fechado');
    await s.page.fill('#cat-search-input', 'caneta');
    await dormir(2500);
    await s.page.reload({ waitUntil: 'load' });
    await dormir(1500);
    ok(!(await bannerVisivel(s.page)), 'banner não reaparece');
    const st = await estadoArmazenado(s.page);
    igual(externosDeMedicao(s), [], 'requisições de medição após recusa');
    igual(JSON.parse(st.consent).analytics, false, 'escolha salva');
    igual(st.dlEventos, 0, 'eventos no dataLayer');
    await s.ctx.close();
  });

  console.log('\n# 3. Aceite + funil da lista escolar (GA4 + PostHog, sem dados pessoais)');
  await teste('3.1 aceitar ativa GA4 (1 page_view, gcs=G111) e PostHog (1 $pageview)', async () => {
    const s = await abrir(browser);
    await irPara(s, base, 'index.html', { esperarBanner: true });
    await s.page.click('[data-consent="aceitar"]');
    await esperar(() => contar(s.ga, 'page_view') >= 1, 12000, 'page_view GA4');
    await esperar(() => contar(s.ph, '$pageview') >= 1, 12000, '$pageview PostHog');
    await dormir(2000);
    igual(contar(s.ga, 'page_view'), 1, 'page_view GA4');
    igual(contar(s.ph, '$pageview'), 1, '$pageview PostHog');
    igual(s.ga.find(h => h.en === 'page_view').tid, GA_ID, 'mesmo ID GA4');
    igual(s.ga.find(h => h.en === 'page_view').gcs, 'G111', 'consent state no hit');
    igual(s.scripts.filter(x => x === 'gtag').length, 1, 'gtag.js baixado uma vez');
    const st = await estadoArmazenado(s.page);
    igual(st.gtagScripts, 1, 'uma única instalação do gtag');
    // nova página já com escolha salva: carrega direto, 1 pageview em cada ferramenta
    await irPara(s, base, 'escolas.html');
    await esperar(() => contar(s.ga, 'page_view') >= 2 && contar(s.ph, '$pageview') >= 2, 12000, '2ª página');
    await dormir(1500);
    igual([contar(s.ga, 'page_view'), contar(s.ph, '$pageview')], [2, 2], 'page_views após 2 páginas');
    ok(!(await bannerVisivel(s.page)), 'banner não reaparece');
    const naoPermitidos = s.ph.filter(e => !['$pageview', '$pageleave', '$opt_in'].includes(e.event));
    igual(naoPermitidos.map(e => e.event), [], 'eventos automáticos inesperados no PostHog');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('3.2 funil completo: eventos corretos, sem duplicação e sem dados pessoais', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    await irPara(s, base, 'lista-escolar.html');
    await page.waitForSelector('#form-upload');
    await page.fill('#nome', PII.responsavel);
    await page.fill('#whatsapp', PII.whatsapp);
    await page.setInputFiles('#arquivo', [ARQ_FIXTURE]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    await page.locator('.item-card .item-choice-option[data-acao="excluir"]').first().click();
    await page.locator('.marca-preferencia-toggle').first().click();
    await page.locator('.marca-preferencia-input').first().fill(PII.marca);
    await page.locator('.marca-preferencia-input').first().press('Tab');
    await page.click('.preferencia-option[data-pref="qualidade"]');
    // 1ª tentativa sem nome da criança: bloqueada pela validação
    await page.click('#btn-enviar');
    await dormir(1000); // passa o debounce de 800 ms do clique
    await page.fill('#aluno-nome', PII.crianca);
    await page.fill('#aluno-cor', PII.cor);
    await page.fill('#aluno-obs', PII.obs);
    await page.click('#btn-enviar');
    await page.waitForSelector('#estado-sucesso.ativo');
    await esperar(() => contar(s.ph, 'school_list_success_view') >= 1, 12000, 'success_view no PostHog');
    await esperar(() => contar(s.ga, 'school_list_success_view') >= 1, 12000, 'success_view no GA4');
    await dormir(3500);

    const esperado = {
      $pageview: 1, school_list_upload_file_selected: 1, school_list_form_attempt: 1, school_list_analysis_started: 1,
      school_list_analysis_completed: 1, school_list_item_toggle: 1, school_list_item_preference_change: 1,
      school_list_budget_preference_change: 1, school_list_send_blocked: 1, school_list_submit_whatsapp: 1,
      school_list_success_view: 1, whatsapp_click: 1,
    };
    const obtido = {};
    for (const n of Object.keys(esperado)) obtido[n] = contar(s.ph, n);
    igual(obtido, esperado, 'contagem de eventos no PostHog');
    const permitidosExtras = ['$pageleave', '$opt_in', 'school_list_continue_to_send'];
    igual(nomesPH(s).filter(n => !(n in esperado) && !permitidosExtras.includes(n)), [], 'eventos fora do esperado');

    const toggle = s.ph.find(e => e.event === 'school_list_item_toggle').properties;
    ok(!('item_id' in toggle), 'item_id da lista escolar não vai ao PostHog');
    igual(toggle.action, 'excluir', 'action do toggle');
    igual(s.ph.find(e => e.event === 'school_list_send_blocked').properties.reason, 'nome_crianca_ausente', 'motivo do bloqueio');
    const sub = s.ph.find(e => e.event === 'school_list_submit_whatsapp').properties;
    igual([sub.lists_count, sub.items_included, sub.items_excluded, sub.items_total], [1, 2, 1, 3], 'props do submit');
    igual(s.ph.find(e => e.event === 'whatsapp_click').properties.event_label, 'whatsapp_principal', 'label WhatsApp');
    ok(s.ph.every(e => !e.properties || !e.properties.$current_url || !e.properties.$current_url.includes('?')), 'URLs sem query string');

    // GA4 preservado: mesmos eventos de antes (incluindo o clique bloqueado, comportamento já existente)
    for (const n of ['school_list_analysis_started', 'school_list_analysis_completed', 'school_list_item_toggle', 'school_list_submit_whatsapp', 'school_list_success_view']) {
      igual(contar(s.ga, n), 1, `GA4 ${n}`);
    }
    igual(contar(s.ga, 'whatsapp_click'), 2, 'GA4 whatsapp_click (inclui tentativa bloqueada, como antes)');

    const phTexto = s.phBruto.join('\n');
    const gaTexto = s.gaBruto.join('\n');
    for (const p of PII_BUSCA) {
      ok(!phTexto.toLowerCase().includes(p.toLowerCase()), `PII "${p}" vazou para o PostHog`);
      { const g = decodeURIComponent(gaTexto); const i = g.toLowerCase().indexOf(p.toLowerCase()); ok(i < 0, `PII "${p}" vazou para o GA4: ...${g.slice(Math.max(0, i - 300), i + 60).replace(/s+/g, " ")}`); }
    }
    const waAberto = s.externos.filter(u => u.startsWith('https://wa.me/')).pop() || '';
    ok(decodeURIComponent(waAberto).includes(PII.crianca) && decodeURIComponent(waAberto).includes(PII.responsavel), 'WhatsApp abre com a mensagem completa: ' + waAberto.slice(0, 120));
    ok(decodeURIComponent(waAberto).includes('[SITE_LISTA_ESCOLAR]'), 'marcador do CRM [SITE_LISTA_ESCOLAR] na mensagem');
    const cliquesGA = s.ga.filter(h => h.en === 'click' && /wa.me/.test(h['ep.link_url'] || ''));
    ok(cliquesGA.every(h => !h['ep.link_url'].includes('?')), 'link_url do GA4 sem query: ' + cliquesGA.map(h => h['ep.link_url']).join(', '));
    for (const termo of ['Caderno universitário', 'cad_universitario', 'Tesoura']) {
      ok(!phTexto.includes(termo), `conteúdo da lista "${termo}" vazou para o PostHog`);
    }
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('3.3 falhas de análise geram school_list_analysis_failed com tipo fixo (host não-local)', async () => {
    const casos = [
      [{ __status: 413, __corpo: 'FUNCTION_PAYLOAD_TOO_LARGE', __tipo: 'text/plain' }, 'arquivo_grande_demais'],
      [{ ok: false, error: 'Nao identificado' }, 'nenhum_item'],
      [{ __status: 500, __corpo: '<html>erro</html>' }, 'resposta_invalida'],
      ['abort', 'conexao'],
    ];
    const s = await abrir(browser, { consent: { analytics: true, marketing: false }, posthog: false });
    const { page } = s;
    await irPara(s, baseNaoLocal, 'lista-escolar.html');
    await page.fill('#nome', PII.responsavel);
    await page.fill('#whatsapp', PII.whatsapp);
    for (const [resposta, tipo] of casos) {
      s.resposta = resposta;
      await page.setInputFiles('#arquivo', [ARQ_FIXTURE]);
      await page.click('#btn-analisar');
      await page.waitForSelector('#lista-erro:not([style*="none"])');
      const ultimo = s.debug.filter(d => d.nome === 'school_list_analysis_failed').pop();
      igual(ultimo && ultimo.dados.error_type, tipo, 'error_type');
      ok(!JSON.stringify(ultimo.dados).includes('lista-secreta'), 'sem nome de arquivo');
      await page.evaluate(() => { document.getElementById('lista-erro').style.display = 'none'; });
    }
    await esperar(() => contar(s.ga, 'school_list_analysis_failed') >= 4, 12000, 'falhas no GA4');
    igual(contar(s.ga, 'school_list_analysis_failed'), 4, 'GA4 recebeu as 4 falhas');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  console.log('\n# 4. Catálogo');
  await teste('4.1 busca: termo digitado nunca vai ao GA4/PostHog nem à URL; campanha preservada; busca funciona', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    const CAMPANHA = 'utm_source=google&utm_medium=cpc&utm_campaign=volta_aulas_2027&gclid=teste123&gbraid=gb456&wbraid=wb789';
    // link antigo com ?q=: o termo sai da URL antes de qualquer tag, mas a busca acontece
    await irPara(s, base, `produtos.html?q=caderno&${CAMPANHA}`);
    await page.waitForSelector('.cat-card');
    ok(page.url().endsWith(`/produtos.html?${CAMPANHA}`), 'URL sem q e com campanha completa: ' + page.url());
    igual(await page.inputValue('#cat-search-input'), 'caderno', 'busca do link aplicada');
    await esperar(() => contar(s.ph, '$pageview') >= 1 && contar(s.ga, 'page_view') >= 1, 12000, 'page_views');
    const pv = s.ph.find(e => e.event === '$pageview').properties;
    ok(pv.$current_url.endsWith(`/produtos.html?${CAMPANHA}`), 'PostHog $current_url: ' + pv.$current_url);
    igual(pv.utm_campaign, 'volta_aulas_2027', 'utm_campaign no PostHog');
    const dl = s.ga.find(h => h.en === 'page_view').dl;
    ok(dl.endsWith(`/produtos.html?${CAMPANHA}`), 'GA4 page_location com campanha, sem q: ' + dl);
    await esperar(() => contar(s.ph, 'catalog_search') >= 1, 12000, 'busca inicial');
    const buscasIniciais = contar(s.ph, 'catalog_search');

    // buscas com cara de dado pessoal: nenhuma pode sair do navegador
    const termos = ['qwkz', 'Mariana Sigilosa', 'joao.silva@exemplo.com', '12 98765-4321'];
    await page.fill('#cat-search-input', '');
    await page.locator('#cat-search-input').pressSequentially('lapis', { delay: 320 }); // buscas parciais
    await dormir(2600);
    for (const t of termos) { await page.fill('#cat-search-input', t); await dormir(2600); }
    await page.locator('#cat-search-input').press('Enter'); // catalog_search_submit
    await esperar(() => contar(s.ph, 'catalog_search') >= buscasIniciais + 5, 12000, 'buscas no PostHog');
    await dormir(3000);
    ok(!page.url().includes('q='), 'URL continua sem a busca: ' + page.url());
    ok(page.url().includes('gclid=teste123') && page.url().includes('wbraid=wb789'), 'campanha segue na URL');

    const buscasPH = s.ph.filter(e => e.event === 'catalog_search').slice(buscasIniciais).map(e => e.properties);
    igual(buscasPH.length, 5, 'PostHog: 1 evento por busca final (sem parciais)');
    ok(buscasPH.every(p => !('search_term' in p) && typeof p.search_term_length === 'number' && typeof p.result_count === 'number'), 'PostHog só com tamanho e nº de resultados: ' + JSON.stringify(buscasPH));
    ok(s.ph.some(e => e.event === 'catalog_search_no_result'), 'no_result registrado (qwkz)');
    const buscasGA = s.ga.filter(h => /^catalog_search(_submit|_no_result)?$/.test(h.en));
    ok(buscasGA.length >= 5, 'GA4 segue recebendo as buscas: ' + buscasGA.length);
    ok(buscasGA.every(h => !('ep.search_term' in h) && 'epn.search_term_length' in h), 'GA4 sem search_term: ' + JSON.stringify(buscasGA.map(h => Object.keys(h).filter(k => /search/.test(k)))));
    ok(contar(s.ga, 'view_search_results') === 0, 'GA4 não gera pesquisa no site a partir da URL');
    const todo = decodeURIComponent(s.gaBruto.join('\n') + '\n' + s.phBruto.join('\n')).toLowerCase();
    for (const t of ['caderno', 'lapis', 'qwkz', 'sigilosa', 'joao.silva', 'exemplo.com', '98765']) {
      const i = todo.indexOf(t);
      ok(i < 0, `termo "${t}" vazou para o analytics: ...${todo.slice(Math.max(0, i - 120), i + 40)}`);
    }

    // recarregar mantém a busca (vem do histórico do navegador, não da URL)
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.cat-card, .cat-search-empty');
    igual(await page.inputValue('#cat-search-input'), '12 98765-4321', 'busca restaurada no reload');
    ok(!page.url().includes('q='), 'reload sem q na URL');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('4.2 produto visto e adição rápida chegam ao PostHog', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    await irPara(s, base, 'produtos.html?q=caderno');
    await page.waitForSelector('.cat-card [data-action="quick-add"]');
    await page.locator('.cat-card [data-action="quick-add"]').first().click();
    await dormir(400);
    await page.locator('.cat-card .cat-card-name-btn').first().click();
    await esperar(() => contar(s.ph, 'catalog_item_quick_add') >= 1 && contar(s.ph, 'catalog_product_view') >= 1, 12000, 'eventos do catálogo');
    await dormir(2500);
    igual(contar(s.ph, 'catalog_item_quick_add'), 1, 'quick add sem duplicar (item_quick_add não vai ao PostHog)');
    igual(contar(s.ph, 'catalog_product_view'), 1, 'product view sem duplicar (item_view não vai ao PostHog)');
    ok(/^[\w-]+$/.test(s.ph.find(e => e.event === 'catalog_item_quick_add').properties.item_id), 'item_id do catálogo');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('4.3 orçamento do catálogo: WhatsApp com mensagem e marcador do CRM; nada pessoal no analytics', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    await irPara(s, base, 'produtos.html?q=caderno&utm_source=google&utm_campaign=volta_aulas_2027&gclid=teste123');
    await page.waitForSelector('.cat-card [data-action="quick-add"]');
    await page.locator('.cat-card [data-action="quick-add"]').first().click();
    await dormir(400);
    await page.locator('[data-cat-open-list]:visible').first().click();
    await page.waitForSelector('#cat-list-send');
    // sem tipo de cliente: envio barrado pela validação (não abre WhatsApp)
    await page.locator('#cat-list-send').evaluate(el => el.click()); // aria-disabled: simula o toque mesmo assim
    await dormir(600);
    igual(s.externos.filter(u => u.startsWith('https://wa.me/')).length, 0, 'WhatsApp não abre sem tipo de cliente');
    await page.check('input[name="cat-client-type"][value="pf"]');
    await page.fill('#cat-list-general-note', `${PII.obs} ${PII.responsavel} ${PII.whatsapp}`);
    await page.locator('#cat-list-general-note').press('Tab');
    await dormir(300);
    const popup = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.click('#cat-list-send');
    await popup;
    await esperar(() => s.externos.some(u => u.startsWith('https://wa.me/')), 8000, 'abertura do WhatsApp');
    await esperar(() => contar(s.ga, 'quote_whatsapp_click') >= 1 && contar(s.ph, 'quote_whatsapp_click') >= 1, 12000, 'quote_whatsapp_click');
    await dormir(2500);

    const wa = decodeURIComponent(s.externos.filter(u => u.startsWith('https://wa.me/')).pop());
    ok(wa.includes('[SITE_CATALOGO_ORCAMENTO]'), 'marcador do CRM [SITE_CATALOGO_ORCAMENTO]: ' + wa.slice(0, 160));
    ok(wa.includes('[TIPO_CLIENTE:PF]') && wa.includes(PII.obs) && wa.includes(PII.responsavel), 'mensagem completa no WhatsApp');
    igual([contar(s.ga, 'quote_whatsapp_click'), contar(s.ph, 'quote_whatsapp_click')], [1, 1], 'quote_whatsapp_click sem duplicar');
    const q = s.ph.find(e => e.event === 'quote_whatsapp_click').properties;
    igual(q.client_type, 'pf', 'client_type');
    const cliquesGA = s.ga.filter(h => h.en === 'click' && /wa.me/.test(h['ep.link_url'] || ''));
    ok(cliquesGA.every(h => !h['ep.link_url'].includes('?')), 'link_url do GA4 sem a mensagem');
    const todo = decodeURIComponent(s.gaBruto.join('\n') + '\n' + s.phBruto.join('\n')).toLowerCase();
    for (const p of [...PII_BUSCA, 'SITE_CATALOGO', 'text=']) {
      const i = todo.indexOf(p.toLowerCase());
      ok(i < 0, `"${p}" vazou para o analytics: ...${todo.slice(Math.max(0, i - 120), i + 40)}`);
    }
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  await teste('4.4 recusa: catálogo, orçamento e WhatsApp funcionam sem nenhuma medição', async () => {
    const s = await abrir(browser, { consent: { analytics: false, marketing: false } });
    const { page } = s;
    await irPara(s, base, 'produtos.html?q=caneta');
    await page.waitForSelector('.cat-card [data-action="quick-add"]');
    await page.locator('.cat-card [data-action="quick-add"]').first().click();
    await page.locator('[data-cat-open-list]:visible').first().click();
    await page.check('input[name="cat-client-type"][value="pj"]');
    const popup = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.click('#cat-list-send');
    await popup;
    await esperar(() => s.externos.some(u => u.startsWith('https://wa.me/')), 8000, 'abertura do WhatsApp');
    ok(decodeURIComponent(s.externos.find(u => u.startsWith('https://wa.me/'))).includes('[SITE_CATALOGO_ORCAMENTO]'), 'mensagem com marcador');
    await dormir(1500);
    igual(externosDeMedicao(s), [], 'nenhuma requisição de medição');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  console.log('\n# 5. Revogação');
  await teste('5.1 revogar pelo rodapé interrompe GA4 e PostHog e limpa identificadores; reaceitar retoma', async () => {
    const s = await abrir(browser);
    const { page } = s;
    await irPara(s, base, 'produtos.html', { esperarBanner: true });
    await page.click('[data-consent="aceitar"]');
    await esperar(() => contar(s.ph, '$pageview') >= 1 && contar(s.ga, 'page_view') >= 1, 12000, 'coleta ativa');
    await esperar(async () => /_ga=/.test(await page.evaluate(() => document.cookie)), 8000, 'cookie _ga');
    await dormir(2500);

    await page.locator('[data-abrir-privacidade]').scrollIntoViewIfNeeded();
    // rolar até o rodapé dispara scroll_depth (com consentimento): espera o lote do GA4 sair antes de revogar
    await esperar(() => contar(s.ga, 'scroll_depth') >= 4, 15000, 'scroll_depth no GA4');
    await dormir(1500);
    await page.click('[data-abrir-privacidade]');
    ok(await page.locator('#consent-opcoes').isVisible(), 'preferências abertas');
    igual(await page.locator('#consent-analytics').isChecked(), true, 'estado atual refletido');
    await page.locator('#consent-analytics').uncheck();
    await page.locator('#consent-marketing').uncheck();
    await page.click('[data-consent="salvar"]');
    const gaAntes = s.gaBruto.length, phAntes = s.ph.length, gaEvAntes = s.ga.length;

    const st = await estadoArmazenado(page);
    igual(st.gaDisable, true, 'ga-disable');
    ok(!/_ga/.test(st.cookies), 'cookies _ga removidos: ' + st.cookies);
    ok(!st.ls.some(k => /^ph_.*_posthog$/.test(k)), 'persistência do PostHog removida');
    const consentUpdate = await page.evaluate(() => window.dataLayer.filter(a => a[0] === 'consent').pop());
    igual(consentUpdate[2].analytics_storage, 'denied', 'consent update denied');

    await page.fill('#cat-search-input', 'borracha');
    await dormir(800);
    await page.locator('.cat-card [data-action="quick-add"]').first().click().catch(() => {});
    await page.mouse.wheel(0, 3000);
    await dormir(5000);
    igual(s.gaBruto.length - gaAntes, 0, 'hits GA4 após revogação: ' + JSON.stringify(s.ga.slice(gaEvAntes).map(h => [h.en, h.gcs, h._et, h['ep.search_term']])));
    igual(s.ph.length - phAntes, 0, 'eventos PostHog após revogação');

    await page.reload({ waitUntil: 'load' });
    await dormir(2500);
    const st2 = await estadoArmazenado(page);
    igual(st2.gtagScripts + st2.phScripts, 0, 'nada carrega após reload revogado');
    igual(s.gaBruto.length - gaAntes, 0, 'sem hits após reload');
    igual(s.ph.length - phAntes, 0, 'sem PostHog após reload');

    // reaceitar
    await page.locator('[data-abrir-privacidade]').scrollIntoViewIfNeeded();
    await page.click('[data-abrir-privacidade]');
    await page.locator('#consent-analytics').check();
    await page.click('[data-consent="salvar"]');
    await esperar(() => contar(s.ph, '$pageview') >= 2, 12000, 'PostHog retoma após reaceite');
    igual(s.erros, [], 'erros de JS');
    await s.ctx.close();
  });

  console.log('\n# 6. Funções de privacidade (unidade, no navegador)');
  await teste('6.1 before_send descarta eventos automáticos e limpa URLs', async () => {
    const s = await abrir(browser);
    await irPara(s, base, 'index.html');
    const r = await s.page.evaluate(() => {
      const C = window.SartecConsent;
      const ev = (event, properties, extra = {}) => C._beforeSend({ event, properties, ...extra });
      const pv = ev('$pageview', {
        $current_url: 'https://www.sartecpapelaria.com.br/produtos.html?q=joao%20silva&categoria=cadernos&utm_source=google&gclid=x1&email=a@b.com#frag',
        $referrer: '$direct', $elements_chain: 'x', $el_text: 'Maria',
        $set_once: { $initial_person_info: { u: 'https://www.sartecpapelaria.com.br/lista-escolar.html?nome=Maria', r: 'https://google.com/search?q=sartec' } },
      });
      return {
        drop: ['$autocapture', '$rageclick', '$exception', '$snapshot', '$heatmap', '$dead_click', '$web_vitals', 'evento_qualquer'].map(n => ev(n, {}) === null),
        url: pv.properties.$current_url, ref: pv.properties.$referrer, chain: '$elements_chain' in pv.properties, text: '$el_text' in pv.properties,
        info: pv.properties.$set_once.$initial_person_info,
        semTermo: !('_limparTermo' in C),
      };
    });
    igual(r.drop, [true, true, true, true, true, true, true, true], 'eventos descartados');
    igual(r.url, 'https://www.sartecpapelaria.com.br/produtos.html?categoria=cadernos&utm_source=google&gclid=x1', 'URL limpa');
    igual(r.ref, '$direct', '$direct preservado');
    igual([r.chain, r.text], [false, false], 'elementos removidos');
    igual(r.info, { u: 'https://www.sartecpapelaria.com.br/lista-escolar.html', r: 'https://google.com/search' }, 'initial_person_info limpo');
    igual(r.semTermo, true, 'não existe mais envio de termo de busca (nem higienizado)');
    await s.ctx.close();
  });

  await teste('6.2 gancho de teste é ignorado fora de localhost (PostHog não liga em host não-produção)', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: false } });
    await irPara(s, baseNaoLocal, 'index.html');
    await dormir(3500);
    igual(s.scripts.filter(x => x.startsWith('posthog')).length, 0, 'PostHog não carregado em host não-local/não-produção');
    ok(s.scripts.includes('gtag'), 'GA4 segue funcionando (comportamento anterior preservado)');
    await s.ctx.close();
  });

  console.log('\n# 7. Mobile');
  for (const device of ['iPhone 13', 'Pixel 7']) {
    await teste(`7.1 ${device}: banner cabe na tela, sem rolagem horizontal, FAB oculto até a escolha; lista funciona`, async () => {
      const s = await abrir(browser, { device });
      const { page } = s;
      await irPara(s, base, 'lista-escolar.html', { esperarBanner: true });
      const m = await page.evaluate(() => {
        const b = document.querySelector('#consent-banner .consent-card').getBoundingClientRect();
        const fab = document.querySelector('.fab-wpp');
        const btns = [...document.querySelectorAll('#consent-banner .consent-btn:not([hidden])')].map(x => Math.round(x.getBoundingClientRect().height));
        return { vw: innerWidth, vh: innerHeight, top: b.top, bottom: Math.round(b.bottom), left: b.left, right: Math.round(b.right), scrollW: document.documentElement.scrollWidth, fabVis: fab ? getComputedStyle(fab).visibility : 'none', btns, alturaPct: b.height / innerHeight };
      });
      ok(m.left >= 0 && m.right <= m.vw && m.bottom <= m.vh + 1 && m.top >= 0, 'banner dentro da viewport ' + JSON.stringify(m));
      ok(m.scrollW <= m.vw, 'sem rolagem horizontal');
      ok(m.alturaPct < 0.6, 'banner ocupa menos de 60% da altura: ' + m.alturaPct.toFixed(2));
      ok(m.btns.every(h => h >= 44), 'alvos de toque >= 44px');
      igual(m.fabVis, 'hidden', 'FAB oculto com banner aberto');
      await page.tap('[data-consent="personalizar"]');
      ok(await page.locator('#consent-opcoes').isVisible(), 'personalizar no mobile');
      await page.tap('[data-consent="salvar"]'); // salva sem marcar nada = recusa
      ok(!(await bannerVisivel(page)), 'banner fecha');
      igual(await page.evaluate(() => getComputedStyle(document.querySelector('.fab-wpp')).visibility), 'visible', 'FAB volta');
      await page.fill('#nome', PII.responsavel);
      await page.fill('#whatsapp', PII.whatsapp);
      await page.setInputFiles('#arquivo', [ARQ_FIXTURE]);
      await page.tap('#btn-analisar');
      await page.waitForSelector('#estado-resultado.ativo');
      igual(externosDeMedicao(s), [], 'nada enviado (escolha: só essenciais)');
      igual(s.erros, [], 'erros de JS');
      await s.ctx.close();
    });
  }

  console.log('\n# 8. Performance');
  await teste('8.1 antes do consentimento nenhum script de terceiros; custo do consent.js', async () => {
    const s = await abrir(browser);
    await irPara(s, base, 'index.html', { esperarBanner: true });
    const tam = fs.statSync(path.join(RAIZ, 'assets', 'consent.js')).size;
    const gz = zlib.gzipSync(fs.readFileSync(path.join(RAIZ, 'assets', 'consent.js'))).length;
    console.log(`        consent.js: ${(tam / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gzip); terceiros antes do aceite: ${externosDeMedicao(s).length}`);
    igual(externosDeMedicao(s).length, 0, 'terceiros de medição');
    ok(gz < 10 * 1024, 'consent.js gzip < 10 KB');
    await s.ctx.close();
  });

  await browser.close();
  srv.close();
  const falhas = resultados.filter(r => !r[1]);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} PASS`);
  if (falhas.length) process.exit(1);
}

rodar().catch((e) => { console.error(e); process.exit(1); });
