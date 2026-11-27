/* ======================================================
   Verificação pós-deploy (prévia da Vercel ou produção) — Playwright + Chromium

   Uso:
     node tests/smoke-remoto.e2e.mjs https://www.sartecpapelaria.com.br
     node tests/smoke-remoto.e2e.mjs https://<previa>.vercel.app "<url de acesso _vercel_share opcional>"

   Seguro para produção:
   - Dados 100% fictícios.
   - /api/analisar-lista é SIMULADA (nenhuma chamada à IA, nenhum custo).
   - WhatsApp (wa.me) é interceptado: a URL é conferida e a abertura é cancelada (nenhuma mensagem real).
   - gtag.js real é baixado, mas os hits do GA4 (/g/collect) são lidos aqui e respondidos localmente:
     nada chega ao GA4 de produção. Sinais de anúncio (doubleclick etc.) são bloqueados.
   - PostHog: no domínio oficial deve ficar inativo sem consentimento e, com consentimento, enviar só
     eventos da lista fechada, sem dados pessoais. As capturas são lidas aqui e respondidas localmente:
     nada chega ao projeto PostHog. Em prévias (fora de PROD_HOSTS) o PostHog deve ficar desligado.
     SMOKE_POSTHOG=0 força a expectativa "desligado".
   ====================================================== */
import { chromium, devices } from 'playwright';
import zlib from 'node:zlib';

const BASE = (process.argv[2] || 'https://www.sartecpapelaria.com.br').replace(/\/$/, '');
const ACESSO = process.argv[3] || null;
const GA_ID = 'G-S5M2P2DX7L';
const PII = ['Mariana Sigilosa', 'Sigilosa', '(12) 98877-6655', '98877-6655', '12988776655', 'Joaquim Confidencial', 'Joaquim', 'azulmarinhounico', 'observacaoprivadaxyz', 'Colegio Particular Sigiloso', 'lista-secreta'];
const CAMPANHA = 'utm_source=google&utm_medium=cpc&utm_campaign=validacao_deploy&gclid=TESTE_GCLID&gbraid=TESTE_GB&wbraid=TESTE_WB';
const RESPOSTA_SIMULADA = {
  ok: true,
  metadados: { escola: 'Colegio Particular Sigiloso', anoSerie: '3º ano', segmento: 'Fundamental', anoLetivo: '2027' },
  itens: [
    { id: 'cad_universitario', nome: 'Caderno universitário 96 folhas', qty: 4, obs: '', unidade: 'un', categoria: 'x', marcaSugerida: '', confianca: 'alta' },
    { id: 'lapis_grafite', nome: 'Lápis grafite nº 2', qty: 6, obs: '', unidade: 'un', categoria: 'x', marcaSugerida: '', confianca: 'alta' },
  ],
  validacaoConjunto: { mesmaCriancaProvavel: true, confianca: 'alta' },
};
const PNG = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), Buffer.alloc(2048)]);

const resultados = [];
async function teste(nome, fn) {
  if (process.env.SO_TESTE && !nome.startsWith(process.env.SO_TESTE)) return; // ex.: SO_TESTE=G
  try { await fn(); resultados.push([nome, true]); console.log('  PASS', nome); }
  catch (e) { resultados.push([nome, false]); console.log('  FAIL', nome, '\n       ', String(e.message || e).split('\n').slice(0, 6).join('\n        ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
async function esperar(cond, ms = 15000, msg = 'condição') {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await cond()) return; await dormir(150); }
  throw new Error('timeout esperando ' + msg);
}
const hostBase = new URL(BASE).hostname;
const PH_ATIVO = process.env.SMOKE_POSTHOG !== '0' && ['www.sartecpapelaria.com.br', 'sartecpapelaria.com.br'].includes(hostBase);
// O PostHog descarta eventos de navegador automatizado ("HeadlessChrome"/webdriver): usa UA de Chrome comum.
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
function decodificarPH(req) {
  const buf = req.postDataBuffer();
  if (!buf || !buf.length) return [];
  try {
    let txt = (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    if (txt.startsWith('data=')) txt = Buffer.from(decodeURIComponent(txt.slice(5)), 'base64').toString('utf8');
    const j = JSON.parse(txt);
    return Array.isArray(j) ? j : (j.batch || [j]);
  } catch (e) { return [{ event: '__nao_decodificado' }]; }
}
const EVENTOS_PH_OK = new Set(['$pageview', '$pageleave', '$opt_in', 'whatsapp_click', 'school_list_upload_file_selected', 'school_list_form_attempt', 'school_list_form_error', 'school_list_analysis_started', 'school_list_analysis_completed', 'school_list_analysis_failed', 'school_list_item_toggle', 'school_list_item_preference_change', 'school_list_budget_preference_change', 'school_list_continue_to_send', 'school_list_send_blocked', 'school_list_submit_whatsapp', 'school_list_success_view', 'school_list_restart', 'school_list_restore', 'catalog_search', 'catalog_search_no_result', 'catalog_product_view', 'catalog_item_quick_add', 'item_custom_add', 'manual_item_add', 'quote_review_start', 'quote_whatsapp_click']);
const contarPH = (s, n) => s.ph.filter(e => e.event === n).length;
function conferirPH(s, esperados) {
  if (!PH_ATIVO) { ok(s.phReq.length === 0, 'PostHog deveria estar desligado neste host: ' + s.phReq.length); return; }
  const fora = s.ph.map(e => e.event).filter(n => !EVENTOS_PH_OK.has(n));
  ok(fora.length === 0, 'eventos fora da lista fechada no PostHog: ' + fora.join(', '));
  for (const [n, qtd] of Object.entries(esperados)) ok(contarPH(s, n) === qtd, `PostHog ${n}: esperado ${qtd}, obtido ${contarPH(s, n)}`);
  ok(s.ph.every(e => !e.properties || !('search_term' in e.properties)), 'termo de busca no PostHog');
  ok(s.ph.every(e => !e.properties || !e.properties.$current_url || !/[?&](q|text)=/.test(e.properties.$current_url)), 'URL com busca/mensagem no PostHog');
}

async function abrir(browser, { device = null, consent = null } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport: { width: 1366, height: 900 }, userAgent: UA_CHROME });
  const s = { ctx, ga: [], gaBruto: [], ph: [], phBruto: [], phReq: [], wa: [], anuncios: [], gtag: 0, erros: [], api: 0 };
  if (consent) {
    await ctx.addInitScript((c) => {
      try { if (!sessionStorage.getItem('__p')) { sessionStorage.setItem('__p', '1'); localStorage.setItem('sartec_consent', JSON.stringify({ v: 1, ...c, ts: Date.now() })); } } catch (_) {}
    }, consent);
  }
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname === hostBase) {
      if (u.pathname === '/api/analisar-lista') { s.api++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPOSTA_SIMULADA) }); }
      return route.continue();
    }
    if (/posthog/.test(u.hostname)) {
      s.phReq.push(req.url());
      if (u.hostname === 'us-assets.i.posthog.com') return route.continue(); // SDK e config públicos
      const evs = decodificarPH(req); // capturas: lidas aqui, nunca enviadas ao projeto
      s.ph.push(...evs);
      s.phBruto.push(req.url() + '\n' + JSON.stringify(evs));
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
    }
    if (/^(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)$/.test(u.hostname)) { s.wa.push(req.url()); return route.abort(); }
    if (u.hostname === 'www.googletagmanager.com' && u.pathname === '/gtag/js') { s.gtag++; return route.continue(); }
    if (/google-analytics\.com|analytics\.google\.com/.test(u.hostname) && /\/g\/collect/.test(u.pathname)) {
      const base = Object.fromEntries(u.searchParams);
      const linhas = (req.postData() || '').split(/\r?\n/).filter(Boolean);
      (linhas.length ? linhas.map(l => ({ ...base, ...Object.fromEntries(new URLSearchParams(l)) })) : [base]).forEach(h => s.ga.push(h));
      s.gaBruto.push(req.url() + '\n' + (req.postData() || ''));
      return route.fulfill({ status: 204, body: '' });
    }
    if (/doubleclick|googleadservices|googlesyndication|google\.com$/.test(u.hostname) && !/fonts/.test(u.hostname)) { s.anuncios.push(req.url()); return route.abort(); }
    return route.continue(); // fontes, imagens, etc.
  });
  ctx.on('page', p => p.on('pageerror', e => s.erros.push(String(e))));
  s.page = await ctx.newPage();
  if (ACESSO) { await s.page.goto(ACESSO, { waitUntil: 'load' }).catch(() => {}); }
  return s;
}
async function ir(s, caminho) {
  await s.page.goto(BASE + '/' + caminho, { waitUntil: 'domcontentloaded' });
  await s.page.waitForLoadState('load').catch(() => {});
}
const medicao = (s) => s.ga.length + s.gtag + s.phReq.length + s.anuncios.length;
function semPII(s, extras = []) {
  const todo = decodeURIComponent(s.gaBruto.join('\n') + '\n' + s.phBruto.join('\n')).toLowerCase();
  for (const p of [...PII, ...extras]) {
    const i = todo.indexOf(p.toLowerCase());
    ok(i < 0, `"${p}" apareceu em envio de analytics:...${todo.slice(Math.max(0, i - 150), i + 50)}`);
  }
}

async function rodar() {
  // SMOKE_HOST_MAP="www.sartecpapelaria.com.br 127.0.0.1": testa o código LOCAL sob o domínio oficial
  // (PostHog ativo com a chave real, capturas ainda interceptadas) antes de qualquer deploy.
  const args = ['--disable-blink-features=AutomationControlled'];
  if (process.env.SMOKE_HOST_MAP) args.push(`--host-resolver-rules=MAP ${process.env.SMOKE_HOST_MAP}`);
  const browser = await chromium.launch({ args });
  console.log(`PostHog esperado: ${PH_ATIVO ? 'ativo após consentimento' : 'desligado'}`);
  console.log(`\nVerificando ${BASE}\n`);

  await teste('A. páginas carregam, banner aparece e nada de medição antes da escolha', async () => {
    const s = await abrir(browser);
    for (const pg of ['', 'produtos.html', 'lista-escolar.html', 'escolas.html', 'empresas.html', 'copias.html']) {
      await ir(s, pg);
      await s.page.waitForSelector('#consent-banner:not([hidden])', { timeout: 10000 });
      await s.page.mouse.wheel(0, 2000);
      await dormir(600);
    }
    await dormir(1500);
    ok(medicao(s) === 0, `medição antes da escolha: ga=${s.ga.length} gtag=${s.gtag} ph=${s.phReq.length} ads=${s.anuncios.length}`);
    ok(await s.page.evaluate(() => typeof window.SartecConsent === 'object' && !window.posthog), 'consent.js ativo e PostHog ausente');
    ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
    await s.ctx.close();
  });

  await teste('B. recusar: catálogo, orçamento, lista e WhatsApp funcionam sem nenhuma medição', async () => {
    const s = await abrir(browser);
    const { page } = s;
    await ir(s, 'produtos.html?' + CAMPANHA);
    await page.click('[data-consent="recusar"]');
    await page.fill('#cat-search-input', 'caderno');
    await page.waitForSelector('.cat-card [data-action="quick-add"]');
    await page.locator('.cat-card [data-action="quick-add"]').first().click();
    await page.locator('[data-cat-open-list]:visible').first().click();
    await page.check('input[name="cat-client-type"][value="pf"]');
    await page.click('#cat-list-send');
    await esperar(() => s.wa.length > 0, 10000, 'WhatsApp do orçamento');
    ok(decodeURIComponent(s.wa.pop()).includes('[SITE_CATALOGO_ORCAMENTO]'), 'marcador do orçamento');
    await ir(s, 'lista-escolar.html');
    await page.fill('#nome', 'Mariana Sigilosa');
    await page.fill('#whatsapp', '(12) 98877-6655');
    await page.setInputFiles('#arquivo', [{ name: 'lista-secreta.png', mimeType: 'image/png', buffer: PNG }]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo', { timeout: 20000 });
    await dormir(1500);
    ok(medicao(s) === 0, `medição após recusa: ga=${s.ga.length} gtag=${s.gtag} ph=${s.phReq.length}`);
    ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
    await s.ctx.close();
  });

  await teste('C. aceitar no catálogo: GA4 único, campanha preservada, busca e orçamento sem dados pessoais', async () => {
    const s = await abrir(browser);
    const { page } = s;
    await ir(s, 'produtos.html?q=caderno&' + CAMPANHA);
    ok(!page.url().includes('q='), 'busca retirada da URL: ' + page.url());
    await page.click('[data-consent="aceitar"]');
    await esperar(() => s.ga.some(h => h.en === 'page_view'), 15000, 'page_view');
    const pv = s.ga.find(h => h.en === 'page_view');
    ok(pv.tid === GA_ID, 'ID do GA4: ' + pv.tid);
    ok(pv.dl.includes('utm_campaign=validacao_deploy') && pv.dl.includes('gclid=TESTE_GCLID') && pv.dl.includes('gbraid=TESTE_GB') && pv.dl.includes('wbraid=TESTE_WB'), 'campanha no page_location: ' + pv.dl);
    ok(!/[?&]q=/.test(pv.dl), 'page_location sem busca');
    ok(pv.gcs === 'G111', 'consentimento no hit: ' + pv.gcs);
    for (const t of ['Mariana Sigilosa', '12 98877-6655']) { await page.fill('#cat-search-input', t); await dormir(1200); }
    await page.fill('#cat-search-input', 'caderno');
    await page.waitForSelector('.cat-card [data-action="quick-add"]');
    await page.locator('.cat-card [data-action="quick-add"]').first().click();
    await page.locator('[data-cat-open-list]:visible').first().click();
    await page.check('input[name="cat-client-type"][value="pf"]');
    await page.fill('#cat-list-general-note', 'observacaoprivadaxyz Mariana Sigilosa');
    await dormir(300);
    await page.click('#cat-list-send');
    await esperar(() => s.wa.length > 0, 10000, 'WhatsApp');
    const wa = decodeURIComponent(s.wa.pop());
    ok(wa.includes('[SITE_CATALOGO_ORCAMENTO]') && wa.includes('observacaoprivadaxyz'), 'mensagem completa com marcador');
    await esperar(() => s.ga.some(h => h.en === 'quote_whatsapp_click'), 15000, 'quote_whatsapp_click');
    await dormir(4000);
    ok(page.url().includes('gclid=TESTE_GCLID'), 'campanha segue na URL do catálogo');
    ok(s.ga.filter(h => h.en === 'page_view').length === 1, 'um único page_view');
    ok(s.gtag === 1, 'gtag.js carregado uma vez: ' + s.gtag);
    ok(s.ga.filter(h => /^catalog_search/.test(h.en)).every(h => !('ep.search_term' in h)), 'buscas sem termo');
    if (PH_ATIVO) await esperar(() => contarPH(s, 'quote_whatsapp_click') >= 1 && contarPH(s, 'catalog_search') >= 1, 15000, 'eventos no PostHog');
    await dormir(PH_ATIVO ? 3000 : 0);
    semPII(s, ['q=caderno', 'search_term=', 'text=', 'SITE_CATALOGO']);
    conferirPH(s, { $pageview: 1, catalog_item_quick_add: 1, quote_whatsapp_click: 1, whatsapp_click: 1 });
    ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
    await s.ctx.close();
  });

  await teste('D. lista escolar com aceite: análise (simulada), revisão, WhatsApp com marcador, sem dados pessoais no GA4', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    await ir(s, 'lista-escolar.html?' + CAMPANHA);
    await esperar(() => s.ga.some(h => h.en === 'page_view'), 15000, 'page_view');
    await page.fill('#nome', 'Mariana Sigilosa');
    await page.fill('#whatsapp', '(12) 98877-6655');
    await page.setInputFiles('#arquivo', [{ name: 'lista-secreta.png', mimeType: 'image/png', buffer: PNG }]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo', { timeout: 20000 });
    ok(s.api === 1, 'análise simulada (sem IA real)');
    await page.click('.preferencia-option[data-pref="qualidade"]').catch(() => {});
    await page.fill('#aluno-nome', 'Joaquim Confidencial');
    await page.fill('#aluno-cor', 'azulmarinhounico');
    await page.fill('#aluno-obs', 'observacaoprivadaxyz');
    await page.click('#btn-enviar');
    await esperar(() => s.wa.length > 0, 10000, 'WhatsApp da lista');
    const wa = decodeURIComponent(s.wa.pop());
    ok(wa.includes('[SITE_LISTA_ESCOLAR]') && wa.includes('Joaquim Confidencial'), 'mensagem completa com marcador');
    await esperar(() => s.ga.some(h => h.en === 'school_list_submit_whatsapp'), 15000, 'school_list_submit_whatsapp');
    await dormir(4000);
    for (const n of ['school_list_analysis_started', 'school_list_analysis_completed', 'school_list_submit_whatsapp']) {
      ok(s.ga.filter(h => h.en === n).length === 1, `GA4 ${n} = 1`);
    }
    if (PH_ATIVO) await esperar(() => contarPH(s, 'school_list_submit_whatsapp') >= 1, 15000, 'submit no PostHog');
    await dormir(PH_ATIVO ? 3000 : 0);
    semPII(s, ['text=', 'SITE_LISTA', 'cad_universitario', 'Caderno universit']);
    ok(s.ga.filter(h => h.en === 'click' && /wa\.me/.test(h['ep.link_url'] || '')).every(h => !h['ep.link_url'].includes('?')), 'link_url sem mensagem');
    conferirPH(s, { $pageview: 1, school_list_analysis_started: 1, school_list_analysis_completed: 1, school_list_submit_whatsapp: 1, whatsapp_click: 1 });
    ok(s.ph.filter(e => e.event === 'school_list_item_toggle').every(e => !('item_id' in e.properties)), 'item_id da lista não vai ao PostHog');
    ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
    await s.ctx.close();
  });

  await teste('E. revogar pelo rodapé interrompe o GA4 e apaga cookies', async () => {
    const s = await abrir(browser, { consent: { analytics: true, marketing: true } });
    const { page } = s;
    await ir(s, '');
    await esperar(async () => /_ga=/.test(await page.evaluate(() => document.cookie)), 15000, 'cookie _ga');
    await page.locator('[data-abrir-privacidade]').scrollIntoViewIfNeeded();
    // rolar até o rodapé gera scroll_depth COM consentimento; o gtag envia em lote alguns segundos
    // depois. Espera esse lote chegar para medir só o que acontece após a revogação.
    await esperar(() => s.ga.filter(h => h.en === 'scroll_depth').length >= 4, 20000, 'lote de scroll_depth');
    await dormir(2000);
    await page.click('[data-abrir-privacidade]');
    await page.locator('#consent-analytics').uncheck();
    await page.locator('#consent-marketing').uncheck();
    await page.click('[data-consent="salvar"]');
    const antes = s.gaBruto.length;
    const phAntes = s.ph.length;
    const nAntes = s.ga.length;
    ok(!/_ga/.test(await page.evaluate(() => document.cookie)), 'cookies _ga removidos');
    await page.mouse.wheel(0, -3000);
    await dormir(5000);
    await ir(s, 'produtos.html');
    await dormir(2500);
    ok(s.ph.length === phAntes, 'eventos PostHog após revogação: ' + s.ph.slice(phAntes).map(e => e.event).join(', '));
    if (PH_ATIVO) ok(!(await page.evaluate(() => Object.keys(localStorage).some(k => /^ph_.*_posthog$/.test(k)))), 'identificador do PostHog apagado');
    ok(s.gaBruto.length === antes, 'hits após revogação: ' + JSON.stringify(s.ga.slice(nAntes).map(h => ({ en: h.en, gcs: h.gcs, et: h._et, dl: h.dl, s: h._s }))));
    await s.ctx.close();
  });

  await teste('G. preferência salva antes do deploy: recusa segue sem coleta; só medição carrega GA4 e PostHog; anúncios só como negados', async () => {
    const r = await abrir(browser, { consent: { analytics: false, marketing: false } });
    for (const pg of ['', 'produtos.html', 'lista-escolar.html']) { await ir(r, pg); await dormir(800); }
    ok(!(await r.page.locator('#consent-banner').isVisible().catch(() => false)), 'banner não reaparece para quem já recusou');
    await dormir(1500);
    ok(medicao(r) === 0, `coleta com recusa salva: ga=${r.ga.length} gtag=${r.gtag} ph=${r.phReq.length}`);
    await r.ctx.close();

    const s = await abrir(browser, { consent: { analytics: true, marketing: false } });
    await ir(s, 'produtos.html?' + CAMPANHA);
    ok(!(await s.page.locator('#consent-banner').isVisible().catch(() => false)), 'banner não reaparece para quem já escolheu');
    await esperar(() => s.ga.some(h => h.en === 'page_view'), 15000, 'page_view');
    const pv = s.ga.find(h => h.en === 'page_view');
    ok(pv.gcs === 'G101', 'GA4 com medição e sem anúncios: ' + pv.gcs);
    if (PH_ATIVO) await esperar(() => contarPH(s, '$pageview') >= 1, 25000, '$pageview PostHog (requisições: ' + s.phReq.map(u => new URL(u).pathname).join(', ') + ' | eventos: ' + s.ph.map(e => e.event).join(', ') + ')');
    await dormir(2500);
    conferirPH(s, { $pageview: 1 });
    // O Google tag tem um destino do Google Ads vinculado (configuração no Google, não no site). Sem o
    // consentimento de publicidade, ele só pode mandar pings sem cookies, marcados como negados e redigidos.
    const adsRuins = s.anuncios.filter(u => !/[?&]gcs=G10[01]/.test(u) || !/[?&]npa=1/.test(u) || /[?&]gclid=(?!0(&|$))/.test(u));
    ok(adsRuins.length === 0, 'ping de anúncios sem marcação de consentimento negado: ' + adsRuins.slice(0, 1).join(' '));
    semPII(s, []);
    ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
    await s.ctx.close();
  });

  for (const device of ['iPhone 13', 'Pixel 7']) {
    await teste(`F. ${device}: banner na tela, sem rolagem horizontal, botões >= 44px`, async () => {
      const s = await abrir(browser, { device });
      const { page } = s;
      for (const pg of ['', 'produtos.html', 'lista-escolar.html']) {
        await ir(s, pg);
        await page.waitForSelector('#consent-banner:not([hidden])', { timeout: 10000 });
        const m = await page.evaluate(() => {
          const b = document.querySelector('#consent-banner .consent-card').getBoundingClientRect();
          return { vw: innerWidth, vh: innerHeight, top: b.top, bottom: b.bottom, sw: document.documentElement.scrollWidth, btns: [...document.querySelectorAll('#consent-banner .consent-btn:not([hidden])')].map(x => x.getBoundingClientRect().height) };
        });
        ok(m.top >= 0 && m.bottom <= m.vh + 1 && m.sw <= m.vw && m.btns.every(h => h >= 44), `${pg || 'home'}: ` + JSON.stringify(m));
      }
      await page.tap('[data-consent="recusar"]');
      ok(medicao(s) === 0, 'nada de medição');
      ok(s.erros.length === 0, 'erros de JS: ' + s.erros.join(' | '));
      await s.ctx.close();
    });
  }

  await browser.close();
  const falhas = resultados.filter(r => !r[1]);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} PASS`);
  if (falhas.length) process.exit(1);
}
rodar().catch((e) => { console.error(e); process.exit(1); });
