/* ======================================================
   Teste e2e manual da Lista Escolar (Playwright + Chrome instalado).
   Não faz parte do `npm run check` e não é dependência do site:
   `playwright` já existe em node_modules, mas não está no package.json.

   Uso (na raiz do projeto):
     node tests/lista-escolar.e2e.mjs          # roda tudo
     node tests/lista-escolar.e2e.mjs upload   # só a Fase A (múltiplos arquivos)
     node tests/lista-escolar.e2e.mjs mobile   # só a Fase B (UX mobile + screenshots)
     node tests/lista-escolar.e2e.mjs payload  # fotos grandes: compressão, limite de envio, FAB

   Requer: Chrome instalado, `playwright` (em node_modules, fora do package.json) e `sharp` (devDependency).
   Screenshots e amostras vão para tests/screenshots/ (ignorado pelo git; SHOTS_DIR muda o destino).

   Não usa a API real: /api/analisar-lista é interceptada e o corpo
   multipart é inspecionado para contar quantos "arquivo" foram enviados.
   ====================================================== */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS_DIR || path.join(RAIZ, 'tests', 'screenshots');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

const ITENS = [
  ['cad_universitario', 'Caderno universitário 96 folhas', 4, 'Capa dura', 'Tilibra'],
  ['lapis_grafite', 'Lápis grafite nº 2', 6, '', 'Faber-Castell'],
  ['borracha_branca', 'Borracha branca', 2, 'Sem capa', ''],
  ['apontador', 'Apontador com depósito', 1, '', ''],
  ['caneta_azul', 'Caneta esferográfica azul', 4, '', 'BIC'],
  ['lapis_cor', 'Caixa de lápis de cor', 1, '24 cores', ''],
  ['tesoura', 'Tesoura sem ponta', 1, '', ''],
  ['cola_bastao', 'Cola bastão', 2, '', 'UHU'],
].map(([id, nome, qty, obs, marcaSugerida]) => ({ id, nome, qty, obs, unidade: 'un', categoria: 'x', marcaSugerida, confianca: 'alta' }));

const RESPOSTA_OK = {
  ok: true,
  metadados: { escola: 'Centro Educacional Azim', anoSerie: 'Infantil I', segmento: 'Educação Infantil', anoLetivo: '2026' },
  itens: ITENS,
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

// ---------- fixtures em disco (mesmo caminho => mesmo lastModified, útil para deduplicação) ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sartec-e2e-'));
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function fixture(nome, bytes = 2048, tipo = 'png') {
  const f = path.join(TMP, nome);
  if (tipo === 'pdf') fs.writeFileSync(f, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(bytes)]));
  else fs.writeFileSync(f, Buffer.concat([PNG_1X1, Buffer.alloc(Math.max(0, bytes - PNG_1X1.length))]));
  return f;
}

// ---------- mini runner ----------
const resultados = [];
async function teste(nome, fn) {
  try { await fn(); resultados.push([nome, true]); console.log('  PASS', nome); }
  catch (e) { resultados.push([nome, false, e]); console.log('  FAIL', nome, '\n       ', process.env.DEBUG ? String(e.message || e) : String(e.message || e).split('\n')[0]); }
}
function igual(real, esperado, msg) {
  if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error(`${msg}: esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(real)}`);
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- sessão de página ----------
async function abrir(browser, base, { viewport, mobile = false, resposta = RESPOSTA_OK, device = null } = {}) {
  const ctx = await browser.newContext(device ? { ...devices[device] } : { viewport: viewport || { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const sessao = { page, ctx, envios: [], corpos: [], eventos: [], resposta, erros: [] };
  await page.addInitScript(() => { window.SARTEC_DEBUG_ANALYTICS = true; });
  // O Chromium não entrega ao Playwright os bytes de partes File/Blob; então medimos dentro da página:
  // tamanho exato do multipart (new Response(formData).blob()) e o conteúdo de cada arquivo enviado.
  await page.exposeFunction('__capturarEnvio', (dados) => {
    sessao.corpos.push({ bytes: dados.bytes, partes: dados.partes.map(p => ({ campo: p.campo, nome: p.nome, tipo: p.tipo, dados: Buffer.from(p.b64, 'base64') })) });
  });
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      if (String(url).includes('/api/analisar-lista') && init && init.body instanceof FormData) {
        const bytes = (await new Response(init.body).blob()).size;
        const partes = [];
        for (const [campo, v] of init.body.entries()) {
          if (!(v instanceof File)) continue;
          const buf = new Uint8Array(await v.arrayBuffer());
          let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          partes.push({ campo, nome: v.name, tipo: v.type, b64: btoa(bin) });
        }
        await window.__capturarEnvio({ bytes, partes });
      }
      return original(url, init);
    };
  });
  page.on('console', async (msg) => {
    if (msg.type() !== 'debug') return;
    const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => null)));
    if (args[0] === '[Sartec Analytics]') sessao.eventos.push({ nome: args[1], dados: args[2] });
  });
  page.on('pageerror', e => sessao.erros.push(String(e)));
  await page.route(/googletagmanager|googleapis|gstatic|clarity/, r => r.abort());
  await page.route('**/api/analisar-lista', async (route) => {
    const corpo = route.request().postDataBuffer() || Buffer.alloc(0);
    const n = (corpo.toString('latin1').match(/name="arquivo"/g) || []).length;
    sessao.envios.push(n);
    const r = typeof sessao.resposta === 'function' ? sessao.resposta(n) : sessao.resposta;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
  });
  await page.goto(`${base}/lista-escolar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#form-upload');
  return sessao;
}

async function preencherResponsavel(page) {
  await page.fill('#nome', 'Maria Teste');
  await page.fill('#whatsapp', '12999998888');
}
const titulo = (page) => page.locator('#arquivos-sel-titulo').innerText();
const qtdItens = (page) => page.locator('#arquivos-sel-lista .arquivo-item').count();
const botaoAnalisar = (page) => page.locator('#btn-analisar').innerText();

// =====================================================================
// FASE A — múltiplos arquivos
// =====================================================================
async function faseUpload(browser, base) {
  console.log('\n# Fase A — upload (iPhone 13, toque)');
  const dev = 'iPhone 13';

  await teste('A1 duas capturas separadas acumulam e o submit envia 2', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('p1.png', 3000)]);   // captura 1
    igual(await qtdItens(page), 1, 'após 1ª captura');
    igual(await titulo(page), '1 página adicionada', 'título 1');
    igual(await botaoAnalisar(page), 'Analisar 1 página', 'CTA 1');
    igual(await page.evaluate(() => document.getElementById('arquivo').files.length), 0, 'input zerado após a 1ª');
    await page.setInputFiles('#arquivo', [fixture('p2.png', 4000)]);   // captura 2 substitui o FileList do input
    igual(await qtdItens(page), 2, 'estado acumulado');
    igual(await titulo(page), '2 páginas adicionadas', 'título 2');
    igual(await botaoAnalisar(page), 'Analisar 2 páginas', 'CTA 2');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2], 'arquivos enviados ao /api');
    await s.ctx.close();
  });

  await teste('A2 várias de uma vez + terceira captura = 3', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('a1.png', 3000), fixture('a2.png', 3100)]);
    igual(await qtdItens(page), 2, 'seleção múltipla');
    await page.setInputFiles('#arquivo', [fixture('a3.png', 3200)]);
    igual(await qtdItens(page), 3, 'acumulado');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [3], 'enviados');
    await s.ctx.close();
  });

  await teste('A3 PDF + imagem: rótulo "arquivos", PDF identificado', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('lista.pdf', 5000, 'pdf')]);
    await page.setInputFiles('#arquivo', [fixture('foto.png', 3000)]);
    igual(await titulo(page), '2 arquivos adicionados', 'título misto');
    igual(await botaoAnalisar(page), 'Analisar 2 arquivos', 'CTA misto');
    ok((await page.locator('#arquivos-sel-lista .arquivo-nome').first().innerText()).startsWith('PDF'), 'PDF identificado');
    igual(await page.locator('#arquivos-sel-lista .arquivo-thumb img').count(), 1, 'só a imagem tem miniatura');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2], 'enviados');
    await s.ctx.close();
  });

  await teste('A4 remover, nome acessível, voltar ao inicial e adicionar de novo', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await page.setInputFiles('#arquivo', [fixture('r1.png', 3000), fixture('r2.png', 3100), fixture('r3.png', 3200)]);
    igual(await page.locator('.arquivo-remover').nth(1).getAttribute('aria-label'), 'Remover página 2', 'aria-label');
    await page.locator('.arquivo-remover').nth(1).click();
    igual(await qtdItens(page), 2, 'após remover 1');
    igual(await titulo(page), '2 páginas adicionadas', 'título após remover');
    igual(await botaoAnalisar(page), 'Analisar 2 páginas', 'CTA após remover');
    await page.locator('.arquivo-remover').first().click();
    await page.locator('.arquivo-remover').first().click();
    igual(await qtdItens(page), 0, 'vazio');
    ok(await page.locator('#upload-area').isVisible(), 'upload inicial volta a aparecer');
    ok(await page.locator('#arquivos-sel').isHidden(), 'lista escondida');
    igual(await botaoAnalisar(page), 'Analisar lista', 'CTA inicial');
    await page.setInputFiles('#arquivo', [fixture('r4.png', 3300)]);
    igual(await qtdItens(page), 1, 'adicionar após esvaziar');
    await s.ctx.close();
  });

  await teste('A5 limite de 5 arquivos; 6º é bloqueado', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    for (let i = 1; i <= 5; i++) await page.setInputFiles('#arquivo', [fixture(`m${i}.png`, 3000 + i)]);
    igual(await qtdItens(page), 5, '5 aceitos');
    ok(await page.locator('#btn-add-pagina').isHidden(), 'botão adicionar some no limite');
    ok(await page.locator('#arquivos-sel-limite').isVisible(), 'mensagem de limite');
    await page.setInputFiles('#arquivo', [fixture('m6.png', 3999)]);
    igual(await qtdItens(page), 5, '6º não entra');
    ok(/até 5 arquivos/.test(await page.locator('#arquivos-aviso').innerText()), 'aviso do 6º');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [5], 'enviados');
    await s.ctx.close();
  });

  await teste('A5b seleção múltipla de 7 de uma vez: entram 5', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await page.setInputFiles('#arquivo', [1, 2, 3, 4, 5, 6, 7].map(i => fixture(`n${i}.png`, 3000 + i)));
    igual(await qtdItens(page), 5, 'só 5');
    await s.ctx.close();
  });

  await teste('A6 PDF grande demais para o envio é recusado na hora; imagem grande NÃO (será comprimida)', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await page.setInputFiles('#arquivo', [fixture('ok.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('grande.pdf', 4_100_000, 'pdf')]);
    igual(await qtdItens(page), 1, 'PDF grande fora');
    ok(/PDF .* grande demais/.test(await page.locator('#arquivos-aviso').innerText()), 'aviso do PDF');
    ok(!/MB/.test(await page.locator('#arquivos-aviso').innerText()), 'sem detalhe de infraestrutura na mensagem');
    await page.setInputFiles('#arquivo', [fixture('foto-grande.png', 6 * 1024 * 1024)]);
    igual(await qtdItens(page), 2, 'imagem grande entra');
    await s.ctx.close();
  });

  await teste('A7 5 imagens de 4 MB (20 MB no total): aceitas e as 5 chegam ao /api, já dentro do limite de envio', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [1, 2, 3, 4, 5].map(i => fixture(`g${i}.png`, 4 * 1024 * 1024)));
    igual(await qtdItens(page), 5, '5 x 4MB');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [5], 'enviados');
    ok(s.corpos[0].bytes <= 4_000_000, 'corpo dentro do limite: ' + s.corpos[0].bytes);
    await s.ctx.close();
  });

  await teste('A8 deduplicação: mesmo arquivo duas vezes entra uma só', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    const f = fixture('dup.png', 3000);
    await page.setInputFiles('#arquivo', [f]);
    await page.setInputFiles('#arquivo', [f]);
    igual(await qtdItens(page), 1, 'sem duplicata');
    ok(/já estava/.test(await page.locator('#arquivos-aviso').innerText()), 'aviso de duplicata');
    await s.ctx.close();
  });

  await teste('A9 tipo não aceito é recusado', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await page.setInputFiles('#arquivo', [{ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.alloc(100) }]);
    igual(await qtdItens(page), 0, 'gif fora');
    ok(/não é PDF, JPG ou PNG/.test(await page.locator('#arquivos-aviso').innerText()), 'aviso de tipo');
    await s.ctx.close();
  });

  await teste('A10 sem arquivos: erro de anexo e nenhuma chamada à API', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.click('#btn-analisar');
    ok(await page.locator('#lista-erro').isVisible(), 'erro visível');
    igual(s.envios, [], 'sem chamadas');
    await s.ctx.close();
  });

  await teste('A11 mesma criança: bloqueio forte limpa a coleção', async () => {
    const s = await abrir(browser, base, { device: dev, resposta: { ...RESPOSTA_OK, validacaoConjunto: { mesmaCriancaProvavel: false, confianca: 'alta' } } });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('c1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('c2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#btn-escolher-novamente');
    ok(/crianças diferentes/.test(await page.locator('#lista-erro').innerText()), 'bloqueio exibido');
    ok(await page.locator('#estado-resultado.ativo').count() === 0, 'não avançou');
    igual(await qtdItens(page), 2, 'arquivos ainda visíveis para o usuário decidir');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-escolher-novamente')]);
    await chooser.setFiles([]);
    igual(await qtdItens(page), 0, 'coleção limpa ao escolher novamente');
    await s.ctx.close();
  });

  await teste('A12 suspeita: confirmação; "Sim" aplica e limpa; "Não" separa e limpa', async () => {
    const suspeita = { ...RESPOSTA_OK, validacaoConjunto: { mesmaCriancaProvavel: false, confianca: 'media' } };
    const s = await abrir(browser, base, { device: dev, resposta: suspeita });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('d1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('d2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#btn-confirmar-mesma-crianca');
    ok(/mesma criança\?/.test(await page.locator('#lista-erro').innerText()), 'pergunta exibida');
    await page.click('#btn-separar-listas');
    igual(await qtdItens(page), 0, 'separar limpa');
    ok(await page.locator('#lista-erro').isHidden(), 'cartão some');

    await page.setInputFiles('#arquivo', [fixture('d3.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('d4.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#btn-confirmar-mesma-crianca');
    await page.click('#btn-confirmar-mesma-crianca');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(await qtdItens(page), 0, 'análise aplicada limpa a coleção');
    igual(s.envios, [2, 2], 'duas análises de 2 arquivos');
    await s.ctx.close();
  });

  await teste('A13 mudar os arquivos com a confirmação aberta invalida a confirmação', async () => {
    const s = await abrir(browser, base, { device: dev, resposta: { ...RESPOSTA_OK, validacaoConjunto: { mesmaCriancaProvavel: false, confianca: 'media' } } });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('e1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('e2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#btn-confirmar-mesma-crianca');
    await page.locator('.arquivo-remover').first().click();
    ok(await page.locator('#btn-confirmar-mesma-crianca').count() === 0, 'confirmação antiga removida');
    await s.ctx.close();
  });

  await teste('A14 multi-lista: a 2ª criança começa sem arquivos da 1ª', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('k1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('k2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    await page.click('#btn-adicionar-lista');
    await page.waitForSelector('#estado-upload.ativo');
    igual(await qtdItens(page), 0, 'upload da 2ª lista vazio');
    igual(await botaoAnalisar(page), 'Analisar lista', 'CTA inicial');
    await page.setInputFiles('#arquivo', [fixture('k3.png', 3300)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2, 1], 'a 2ª análise levou só 1 arquivo');
    await s.ctx.close();
  });

  await teste('A15 limpar pedido esvazia a coleção', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('l1.png', 3000)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    await page.click('#btn-recomecar', { force: true });
    await page.click('#le-modal-confirmar');
    await page.waitForSelector('#estado-upload.ativo');
    igual(await qtdItens(page), 0, 'vazio');
    await preencherResponsavel(page); // "limpar pedido" também zera nome e WhatsApp
    await page.setInputFiles('#arquivo', [fixture('l2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [1, 1], 'sem vazamento');
    await s.ctx.close();
  });

  await teste('A16 object URLs de miniaturas são revogados ao remover/limpar', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await page.evaluate(() => {
      window.__criadas = 0; window.__revogadas = 0;
      const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (x) => { window.__criadas++; return c(x); };
      URL.revokeObjectURL = (x) => { window.__revogadas++; return r(x); };
    });
    await page.setInputFiles('#arquivo', [fixture('o1.png', 3000), fixture('o2.png', 3100), fixture('o3.png', 3200)]);
    await page.locator('.arquivo-remover').first().click();
    let c = await page.evaluate(() => [window.__criadas, window.__revogadas]);
    igual(c, [3, 1], 'criadas/revogadas após remover 1 (sem recriar a cada render)');
    await page.evaluate(() => limparArquivos());
    c = await page.evaluate(() => [window.__criadas, window.__revogadas]);
    igual(c, [3, 3], 'tudo revogado ao limpar');
    await s.ctx.close();
  });

  await teste('A17 analytics: file_count acumulado e nenhum dado pessoal/nome de arquivo', async () => {
    const s = await abrir(browser, base, { device: dev });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('segredo-foto-1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('segredo-foto-2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    const sel = s.eventos.filter(e => e.nome === 'school_list_upload_file_selected').map(e => e.dados.file_count);
    igual(sel, [1, 2], 'file_count acumulado');
    const bruto = JSON.stringify(s.eventos);
    for (const proibido of ['segredo-foto', 'Maria Teste', '12999998888', '99999-8888', 'Caderno', 'Azim']) ok(!bruto.includes(proibido), `evento vazou "${proibido}"`);
    await s.ctx.close();
  });

  await teste('A18 desktop (1440): upload múltiplo e drop também acumulam', async () => {
    const s = await abrir(browser, base, { viewport: { width: 1440, height: 900 } });
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('t1.png', 3000)]);
    // simula drop de arquivo com DataTransfer
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(2500)], 'solto.png', { type: 'image/png', lastModified: 1 }));
      document.getElementById('arquivos-sel').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    igual(await qtdItens(page), 2, 'upload + drop');
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2], 'enviados');
    await s.ctx.close();
  });
}

// =====================================================================
const alvo = process.argv[2] || 'tudo';
const srv = await servir();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
fs.mkdirSync(SHOTS, { recursive: true });

if (alvo === 'tudo' || alvo === 'upload') await faseUpload(browser, base);
if (alvo === 'tudo' || alvo === 'payload') {
  const { fasePayload } = await import('./lista-escolar.payload.mjs');
  await fasePayload({ browser, base, teste, igual, ok, abrir, preencherResponsavel, fixture, SHOTS, TMP });
}
if (alvo === 'tudo' || alvo === 'mobile') {
  try {
    const { faseMobile } = await import('./lista-escolar.mobile.mjs');
    await faseMobile({ browser, base, teste, igual, ok, abrir, preencherResponsavel, fixture, SHOTS, RESPOSTA_OK, devices });
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    console.log('\n(Fase B ainda sem testes)');
  }
}

await browser.close();
srv.close();
fs.rmSync(TMP, { recursive: true, force: true });
const falhas = resultados.filter(r => !r[1]);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} testes passaram`);
process.exit(falhas.length ? 1 : 0);
