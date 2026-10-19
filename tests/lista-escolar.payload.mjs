/* Fotos grandes de celular: compressão no cliente, limite real de envio (Vercel: 4,5 MB) e FAB.
   Carregado por tests/lista-escolar.e2e.mjs (não rodar direto). */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LIMITE_ENVIO = 4_000_000; // mesmo orçamento de lista.js (ORCAMENTO_ENVIO_BYTES)
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';

// Página de lista escolar fotografada: texto preto em papel, ruído de sensor (é o que deixa a foto de celular pesada)
async function fotoDeLista({ largura, altura, orientacao, ruido = 110, qualidade = 95 }) {
  const linhas = [
    'LISTA DE MATERIAIS 2026 - 3o ANO', '04 Caderno universitario 96 folhas capa dura', '06 Lapis grafite no 2 (Faber-Castell)',
    '02 Borracha branca macia', '01 Apontador com deposito', '04 Caneta esferografica azul', '01 Caixa de lapis de cor 24 cores',
    '01 Caixa de canetinha hidrocor 12 cores', '01 Tesoura sem ponta', '02 Cola bastao 40g', '01 Resma de papel sulfite A4',
  ];
  // fonte grande o bastante para ~12pt numa folha A4 em 3000 px de largura (cada linha ~ 60 px)
  const fs_ = Math.round(Math.min(largura, altura) / 50);
  const texto = linhas.map((l, i) => `<text x="${Math.round(largura * 0.08)}" y="${Math.round(altura * 0.1) + i * fs_ * 2.4}" font-family="Arial, Helvetica, sans-serif" font-size="${fs_}" fill="#111">${l}</text>`).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><rect width="100%" height="100%" fill="#f4f1ea"/>${texto}</svg>`);
  const base = await sharp(svg).png().toBuffer();
  const ruidoImg = await sharp({ create: { width: largura, height: altura, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: ruido } } }).png().toBuffer();
  let img = sharp(base).composite([{ input: ruidoImg, blend: 'overlay' }]).jpeg({ quality: qualidade });
  if (orientacao) img = img.withMetadata({ orientation: orientacao });
  const buf = await img.toBuffer();
  return buf;
}

export async function fasePayload(ctx) {
  const { browser, base, teste, igual, ok, abrir, preencherResponsavel, SHOTS, TMP } = ctx;
  console.log('\n# Payload — fotos grandes, compressão e FAB');

  const gerar = async (nome, opts) => {
    const buf = await fotoDeLista({ ...opts, nome });
    const f = path.join(TMP, nome);
    fs.writeFileSync(f, buf);
    return { arquivo: f, bytes: buf.length, nome };
  };

  // Mede o que de fato chegou ao /api e anota "original -> enviado"
  async function medirEnvio(s, originais) {
    const corpo = s.corpos[s.corpos.length - 1];
    const linhas = [];
    for (let i = 0; i < corpo.partes.length; i++) {
      const p = corpo.partes[i];
      const m = await sharp(p.dados).metadata();
      linhas.push({ original: originais[i].bytes, enviado: p.dados.length, tipo: p.tipo, w: m.width, h: m.height, nome: p.nome });
    }
    return { corpo: corpo.bytes, linhas };
  }
  const imprimir = (titulo, r) => {
    console.log(`       ${titulo}: corpo do request ${mb(r.corpo)}`);
    r.linhas.forEach((l, i) => console.log(`         #${i + 1} ${mb(l.original)} -> ${mb(l.enviado)}  ${l.w}x${l.h}  ${l.tipo}`));
  };

  const dev = 'iPhone 13';

  await teste('P1 uma foto grande (~6 MB): aparece na UI, é comprimida e cabe no limite', async () => {
    const f = await gerar('p1.jpg', { largura: 4032, altura: 3024 });
    ok(f.bytes > 4_500_000, 'a amostra precisa estourar o limite sozinha: ' + mb(f.bytes));
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [f.arquivo]);
    igual(await s.page.locator('#arquivos-sel-lista .arquivo-item').count(), 1, 'na UI');
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [1], 'arquivos no FormData');
    const r = await medirEnvio(s, [f]);
    imprimir('1 foto', r);
    ok(r.corpo <= LIMITE_ENVIO, 'corpo <= 4.0 MB: ' + r.corpo);
    ok(Math.max(r.linhas[0].w, r.linhas[0].h) <= 1800, 'lado maior <= 1800');
    igual(r.linhas[0].tipo, 'image/jpeg', 'tipo');
    await s.ctx.close();
  });

  await teste('P2 duas fotos grandes em seleções separadas (câmera): as duas chegam, comprimidas', async () => {
    const a = await gerar('p2a.jpg', { largura: 4032, altura: 3024 });
    const b = await gerar('p2b.jpg', { largura: 4032, altura: 3024, ruido: 105 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [a.arquivo]);
    await s.page.setInputFiles('#arquivo', [b.arquivo]);
    igual(await s.page.locator('#arquivos-sel-lista .arquivo-item').count(), 2, 'na UI');
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2], 'arquivos no FormData');
    const r = await medirEnvio(s, [a, b]);
    imprimir('2 fotos', r);
    ok(r.corpo <= LIMITE_ENVIO, 'corpo <= 4.0 MB: ' + r.corpo);
    await s.ctx.close();
  });

  await teste('P3 cinco fotos grandes (~25 MB): todas representadas, todas enviadas, conjunto dentro do limite', async () => {
    const fotos = [];
    for (let i = 1; i <= 5; i++) fotos.push(await gerar(`p3-${i}.jpg`, { largura: 4032, altura: 3024, ruido: 105 + i }));
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    for (const f of fotos) await s.page.setInputFiles('#arquivo', [f.arquivo]);
    igual(await s.page.locator('#arquivos-sel-lista .arquivo-item').count(), 5, 'na UI');
    igual(await s.page.locator('#arquivos-sel-titulo').innerText(), '5 páginas adicionadas', 'título');
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo', { timeout: 60000 });
    igual(s.envios, [5], 'arquivos no FormData');
    const r = await medirEnvio(s, fotos);
    imprimir('5 fotos', r);
    ok(r.corpo <= LIMITE_ENVIO, 'corpo <= 4.0 MB: ' + r.corpo);
    ok(r.linhas.every(l => l.tipo === 'image/jpeg' && Math.max(l.w, l.h) <= 1800), 'todas JPEG com lado <= 1800');
    ok(r.linhas.every(l => Math.max(l.w, l.h) >= 1200), 'nenhuma caiu abaixo de 1200 px (legibilidade)');
    // amostra para inspeção humana: página inteira e recorte 1:1 do texto
    const p = s.corpos[0].partes[0].dados;
    fs.writeFileSync(path.join(SHOTS, 'amostra-5fotos-pagina.jpg'), p);
    const m = await sharp(p).metadata();
    await sharp(p).extract({ left: 0, top: 0, width: Math.min(900, m.width), height: Math.min(500, m.height) }).toFile(path.join(SHOTS, 'amostra-5fotos-recorte-1a1.png'));
    await s.ctx.close();
  });

  await teste('P4 imagem panorâmica/alta resolução (10000x2500): comprimida, lado maior <= 1800', async () => {
    const f = await gerar('p4.jpg', { largura: 10000, altura: 2500, ruido: 100 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [f.arquivo]);
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo', { timeout: 60000 });
    const r = await medirEnvio(s, [f]);
    imprimir('panorâmica', r);
    ok(r.corpo <= LIMITE_ENVIO, 'corpo <= 4.0 MB');
    ok(r.linhas[0].w <= 1800 && r.linhas[0].w > r.linhas[0].h * 3, 'proporção preservada: ' + r.linhas[0].w + 'x' + r.linhas[0].h);
    await s.ctx.close();
  });

  await teste('P5 orientação EXIF: foto de celular em pé (EXIF 6) sai em pé', async () => {
    const f = await gerar('p5.jpg', { largura: 4032, altura: 3024, orientacao: 6, ruido: 105 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [f.arquivo, (await gerar('p5b.jpg', { largura: 4032, altura: 3024, orientacao: 6, ruido: 108 })).arquivo]);
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo', { timeout: 60000 });
    const r = await medirEnvio(s, [f, f]);
    imprimir('EXIF 6', r);
    ok(r.linhas.every(l => l.h > l.w), 'saída em retrato: ' + r.linhas.map(l => `${l.w}x${l.h}`));
    await s.ctx.close();
  });

  await teste('P6 só comprime quando necessário: fotos pequenas seguem idênticas (mesmos bytes)', async () => {
    const f = await gerar('p6.jpg', { largura: 1600, altura: 1200, ruido: 8, qualidade: 80 });
    ok(f.bytes < 900_000, 'amostra pequena: ' + mb(f.bytes));
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [f.arquivo]);
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo');
    const enviado = s.corpos[0].partes[0];
    igual(enviado.dados.length, f.bytes, 'mesmo tamanho');
    ok(Buffer.compare(enviado.dados, fs.readFileSync(f.arquivo)) === 0, 'bytes idênticos');
    igual(enviado.nome, 'p6.jpg', 'nome original');
    await s.ctx.close();
  });

  await teste('P7 PDF + fotos grandes: o PDF segue idêntico e só as fotos são comprimidas', async () => {
    const pdf = path.join(TMP, 'p7.pdf');
    fs.writeFileSync(pdf, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(700_000, 7)]));
    const a = await gerar('p7a.jpg', { largura: 4032, altura: 3024 });
    const b = await gerar('p7b.jpg', { largura: 4032, altura: 3024, ruido: 108 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [pdf, a.arquivo, b.arquivo]);
    igual(await s.page.locator('#arquivos-sel-titulo').innerText(), '3 arquivos adicionados', 'título');
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo', { timeout: 60000 });
    const c = s.corpos[0];
    igual(c.partes.length, 3, 'partes');
    ok(Buffer.compare(c.partes[0].dados, fs.readFileSync(pdf)) === 0, 'PDF idêntico');
    igual(c.partes[0].tipo, 'application/pdf', 'tipo do PDF');
    ok(c.bytes <= LIMITE_ENVIO, 'corpo <= 4.0 MB: ' + c.bytes);
    console.log(`       PDF 0.67 MB -> 0.67 MB | fotos ${mb(a.bytes)} -> ${mb(c.partes[1].dados.length)}, ${mb(b.bytes)} -> ${mb(c.partes[2].dados.length)}; corpo ${mb(c.bytes)}`);
    await s.ctx.close();
  });

  await teste('P8 erro claro quando nem comprimindo cabe (3 PDFs que quase enchem o limite + foto)', async () => {
    const pdfs = [1, 2, 3].map(i => { const f = path.join(TMP, `p8-${i}.pdf`); fs.writeFileSync(f, Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1_327_000, i)])); return f; });
    const foto = await gerar('p8.jpg', { largura: 4032, altura: 3024 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [...pdfs, foto.arquivo]);
    igual(await s.page.locator('#arquivos-sel-lista .arquivo-item').count() >= 3, true, 'PDFs entram um a um');
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#lista-erro', { state: 'visible', timeout: 60000 });
    ok(/grandes demais|reduzir/.test(await s.page.locator('#lista-erro').innerText()), 'mensagem clara');
    igual(s.envios, [], 'nada foi enviado');
    ok(await s.page.locator('#estado-upload.ativo').count() === 1, 'volta ao upload com os arquivos');
    ok(!(await s.page.locator('#btn-analisar').isDisabled()), 'botão habilitado');
    await s.ctx.close();
  });

  await teste('P9 resposta 413 da infraestrutura vira mensagem clara (não "erro de conexão")', async () => {
    const s = await abrir(browser, base, { device: dev });
    await s.page.unroute('**/api/analisar-lista');
    await s.page.route('**/api/analisar-lista', r => r.fulfill({ status: 413, contentType: 'text/plain', body: 'Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE' }));
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [(await gerar('p9.jpg', { largura: 1200, altura: 900, ruido: 8, qualidade: 80 })).arquivo]);
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#lista-erro', { state: 'visible' });
    const t = await s.page.locator('#lista-erro').innerText();
    ok(/grandes demais/.test(t) && !/conexão/.test(t), t);
    await s.ctx.close();
  });

  await teste('P10 sem vazamento de blobs: object URLs criados pela compressão são revogados', async () => {
    const a = await gerar('p10a.jpg', { largura: 4032, altura: 3024 });
    const b = await gerar('p10b.jpg', { largura: 4032, altura: 3024, ruido: 108 });
    const s = await abrir(browser, base, { device: dev });
    await preencherResponsavel(s.page);
    await s.page.setInputFiles('#arquivo', [a.arquivo, b.arquivo]);
    await s.page.evaluate(() => {
      window.__c = 0; window.__r = 0;
      const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (x) => { window.__c++; return c(x); };
      URL.revokeObjectURL = (x) => { window.__r++; return r(x); };
    });
    await s.page.click('#btn-analisar');
    await s.page.waitForSelector('#estado-resultado.ativo', { timeout: 60000 });
    const [c, r] = await s.page.evaluate(() => [window.__c, window.__r]);
    // a compressão cria 1 URL por imagem; a conclusão da análise limpa a coleção e revoga as 2 miniaturas
    igual(c, 2, 'URLs criadas pela compressão');
    igual(r, 4, 'revogadas: 2 da compressão + 2 miniaturas ao limpar');
    await s.ctx.close();
  });

  // ---------------- FAB ----------------
  await teste('F1 390px: o FAB não colide com o CTA "Analisar" e volta fora do formulário', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await page.waitForSelector('.fab-wpp');
    const fabVisivel = () => page.locator('.fab-wpp').evaluate(e => getComputedStyle(e).display !== 'none');
    ok(await fabVisivel(), 'FAB visível no topo da página (hero)');
    await page.screenshot({ path: path.join(SHOTS, '390-14-hero-com-fab.png') });
    // percorre o formulário inteiro: o FAB nunca pode sobrepor o botão quando ambos estão na tela
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [path.join(TMP, 'p1.jpg')]);
    for (const alvo of ['#btn-analisar', '#btn-add-pagina', '#upload-area, #arquivos-sel']) {
      await page.evaluate((q) => document.querySelector(q).scrollIntoView({ block: 'end' }), alvo);
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        const f = document.querySelector('.fab-wpp'); const b = document.getElementById('btn-analisar');
        const fv = getComputedStyle(f).display !== 'none'; const fr = f.getBoundingClientRect(); const br = b.getBoundingClientRect();
        const colide = fv && fr.left < br.right && fr.right > br.left && fr.top < br.bottom && fr.bottom > br.top;
        return { fv, colide };
      });
      ok(!r.colide, `FAB sobrepõe o CTA ao rolar até ${alvo}`);
    }
    ok(!(await fabVisivel()), 'FAB oculto enquanto o formulário está na tela');
    await page.evaluate(() => document.getElementById('btn-analisar').scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, '390-15-upload-cta-sem-fab.png') });
    await page.evaluate(() => document.querySelector('.loja-fw').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    ok(await fabVisivel(), 'FAB volta fora do formulário');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    ok(await fabVisivel(), 'FAB no topo');
    await s.ctx.close();
  });

  await teste('F2 durante a análise (loading) o FAB fica oculto no mobile', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await s.page.unroute('**/api/analisar-lista');
    await s.page.route('**/api/analisar-lista', async r => { await new Promise(res => setTimeout(res, 1200)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, metadados: {}, itens: [{ id: 'a', nome: 'A', qty: 1, obs: '', marcaSugerida: '' }] }) }); });
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [path.join(TMP, 'p9.jpg')]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-loading.ativo');
    ok(!(await page.locator('.fab-wpp').evaluate(e => getComputedStyle(e).display !== 'none')), 'FAB oculto no loading');
    await page.waitForSelector('#estado-resultado.ativo');
    await s.ctx.close();
  });

  await teste('F3 1440px: o FAB continua visível e igual no upload (desktop sem regressão)', async () => {
    const s = await abrir(browser, base, { viewport: { width: 1440, height: 900 } });
    const { page } = s;
    await page.waitForSelector('.fab-wpp');
    await page.evaluate(() => document.getElementById('btn-analisar').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    ok(await page.locator('.fab-wpp').evaluate(e => getComputedStyle(e).display !== 'none'), 'FAB visível no desktop');
    ok(await page.evaluate(() => !document.body.classList.contains('le-fab-oculto') || getComputedStyle(document.querySelector('.fab-wpp')).display !== 'none'), 'classe não afeta o desktop');
    await s.ctx.close();
  });

  await teste('F4 outras páginas: o FAB global não foi tocado (index.html mobile continua visível)', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    await s.page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForSelector('.fab-wpp');
    ok(await s.page.locator('.fab-wpp').evaluate(e => getComputedStyle(e).display !== 'none'), 'FAB visível na home');
    await s.ctx.close();
  });
}
