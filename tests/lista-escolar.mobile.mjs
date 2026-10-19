/* Fase B — UX mobile da revisão + responsividade + screenshots.
   Carregado por tests/lista-escolar.e2e.mjs (não rodar direto). */
import path from 'node:path';

const VIEWPORTS = [
  { w: 375, h: 812, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 430, h: 932, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1024, h: 768, mobile: false },
  { w: 1440, h: 900, mobile: false },
];

export async function faseMobile(ctx) {
  const { browser, base, teste, igual, ok, abrir, preencherResponsavel, fixture, SHOTS, RESPOSTA_OK } = ctx;
  console.log('\n# Fase B — UX mobile, responsividade e screenshots');

  const shot = (page, w, nome, opts = {}) => page.screenshot({ path: path.join(SHOTS, `${w}-${nome}.png`), ...opts });
  const overflowH = (page) => page.evaluate(() => {
    const larg = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= larg + 1) return null;
    const culpado = [...document.querySelectorAll('body *')].find(e => e.getBoundingClientRect().right > larg + 1 && getComputedStyle(e).position !== 'fixed');
    return `scrollWidth ${document.documentElement.scrollWidth} > ${larg}; ex.: <${culpado?.tagName.toLowerCase()} class="${culpado?.className}">`;
  });
  const rolarPara = async (page, sel, bloco = 'start') => {
    await page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b }), [sel, bloco]);
    await page.waitForTimeout(220);
  };

  async function ateResultado(s, w) {
    const { page } = s;
    await preencherResponsavel(page);
    await page.setInputFiles('#arquivo', [fixture('b1.png', 3000)]);
    await page.setInputFiles('#arquivo', [fixture('b2.png', 3100)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    await page.waitForTimeout(300);
  }

  // ------------------------------------------------------------------
  // Responsividade + screenshots, em todas as larguras pedidas
  // ------------------------------------------------------------------
  for (const v of VIEWPORTS) {
    await teste(`B1 ${v.w}px: sem scroll horizontal em upload, páginas, revisão, final e sucesso (+ screenshots)`, async () => {
      const s = await abrir(browser, base, { viewport: { width: v.w, height: v.h }, mobile: v.mobile });
      const { page } = s;
      const estados = [];
      estados.push(['upload', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '01-upload-vazio');
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.le-upload-mascote').getBoundingClientRect().top + scrollY - 130));
      await page.waitForTimeout(250);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '02-upload-vermelho');

      await preencherResponsavel(page);
      await page.setInputFiles('#arquivo', [fixture('v1.png', 3000)]);
      await page.setInputFiles('#arquivo', [fixture('v2.png', 3100)]);
      await rolarPara(page, '#grupo-arquivos', 'center');
      estados.push(['upload-com-paginas', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '03-upload-com-paginas');

      await page.click('#btn-analisar');
      await page.waitForSelector('#estado-resultado.ativo');
      await page.waitForTimeout(350);
      await page.evaluate(() => window.scrollTo(0, 0));
      await rolarPara(page, '#le-revisao-topo', 'start');
      estados.push(['revisao-topo', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '04-revisao-etapa-1');

      await rolarPara(page, '#le-etapa-2', 'start');
      estados.push(['etapa-2', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '05-revisao-etapa-2');

      await rolarPara(page, '#bloco-preferencia', 'start');
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '06-criterio-orcamento');

      await rolarPara(page, '#le-etapa-3', 'start');
      estados.push(['etapa-3', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '07-revisao-etapa-3-itens');

      await rolarPara(page, '#le-etapa-4', 'start');
      estados.push(['etapa-4', await overflowH(page)]);
      if (v.w <= 430 || v.w === 1440) await shot(page, v.w, '08-revisao-etapa-4-envio');

      if (v.w <= 430) {
        await page.evaluate(() => document.querySelector('.le-depois-det')?.setAttribute('open', ''));
        await rolarPara(page, '.le-depois', 'start');
        await shot(page, v.w, '09-depois-do-envio-aberto');
        estados.push(['depois-aberto', await overflowH(page)]);
        await page.evaluate(() => document.querySelector('.le-depois-det')?.removeAttribute('open'));
      }
      if (v.w === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
        await shot(page, v.w, '10-revisao-pagina-inteira', { fullPage: true });
      }

      // Sucesso (clique válido no CTA do WhatsApp; abre popup que ignoramos)
      await page.fill('#aluno-nome', 'Aluno Teste');
      await page.fill('#aluno-cor', 'qualquer cor');
      await page.evaluate(() => { document.getElementById('btn-enviar').removeAttribute('target'); document.getElementById('btn-enviar').addEventListener('click', e => e.preventDefault(), true); });
      await page.click('#btn-enviar', { force: true });
      await page.waitForSelector('#estado-sucesso.ativo');
      await page.waitForTimeout(700);
      estados.push(['sucesso', await overflowH(page)]);
      if (v.w <= 430) await shot(page, v.w, '11-sucesso');

      const falhas = estados.filter(([, e]) => e);
      ok(falhas.length === 0, 'scroll horizontal em: ' + falhas.map(([n, e]) => `${n} (${e})`).join('; '));
      igual(s.erros, [], 'erros de JS na página');
      await s.ctx.close();
    });
  }

  // ------------------------------------------------------------------
  // Comportamento mobile (390)
  // ------------------------------------------------------------------
  await teste('B2 mobile: etapa 1 mostra resumo e só abre os 4 campos em "Editar" (ids preservados)', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    igual(await page.locator('#meta-resumo-escola').innerText(), 'Centro Educacional Azim', 'escola');
    igual(await page.locator('#meta-resumo-detalhe').innerText(), 'Infantil I · Educação Infantil · 2026', 'detalhe');
    ok(await page.locator('#meta-escola').isHidden(), 'campos escondidos');
    igual(await page.locator('#meta-editar').getAttribute('aria-expanded'), 'false', 'aria-expanded fechado');
    await page.click('#meta-editar');
    for (const id of ['meta-escola', 'meta-anoSerie', 'meta-segmento', 'meta-anoLetivo']) ok(await page.locator('#' + id).isVisible(), id + ' visível');
    igual(await page.locator('#meta-editar').getAttribute('aria-expanded'), 'true', 'aria-expanded aberto');
    await page.fill('#meta-anoLetivo', '2027');
    igual(await page.locator('#meta-resumo-detalhe').innerText(), 'Infantil I · Educação Infantil · 2027', 'resumo acompanha a edição');
    igual(await page.evaluate(() => estado.rascunho.metadados.anoLetivo), '2027', 'estado atualizado');
    await page.click('#meta-editar');
    ok(await page.locator('#meta-escola').isHidden(), 'fecha de novo');
    await s.ctx.close();
  });

  await teste('B3 desktop (1440): etapa 1 continua com os 4 inputs visíveis, sem resumo nem barra compacta', async () => {
    const s = await abrir(browser, base, { viewport: { width: 1440, height: 900 } });
    const { page } = s;
    await ateResultado(s);
    for (const id of ['meta-escola', 'meta-anoSerie', 'meta-segmento', 'meta-anoLetivo']) ok(await page.locator('#' + id).isVisible(), id + ' visível');
    ok(await page.locator('.meta-resumo').isHidden(), 'resumo escondido no desktop');
    ok(await page.locator('#le-barra').isHidden(), 'barra compacta escondida no desktop');
    igual(await page.evaluate(() => getComputedStyle(document.querySelector('.acoes-finais')).position), 'sticky', 'barra final segue sticky no desktop');
    igual(await page.locator('.le-etapas li').count(), 4, '4 etapas');
    ok(await page.locator('.le-etapas-txt').first().isVisible(), 'cards de etapas com texto no desktop');
    ok(await page.locator('.le-guia-corpo').isVisible(), 'guia completo no desktop');
    ok(await page.locator('.le-guia-mob').isHidden(), 'guia curto escondido no desktop');
    ok(await page.locator('.le-depois-desk').isVisible() && await page.locator('.le-depois-mob').isHidden(), 'depois do envio: 4 cards no desktop');
    ok((await page.locator('#aluno-nome').evaluate(e => e.closest('label').innerText)).includes('Nome da criança/aluno'), 'rótulo longo no desktop');
    await s.ctx.close();
  });

  await teste('B4 mobile: copy curta da criança + critério em linhas, padrão "Mais econômico", seleção funciona', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    igual(await page.locator('#le-et2-t').innerText(), 'Sobre a criança', 'título etapa 2');
    const rotulos = await page.locator('#bloco-aluno label').evaluateAll(ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').trim()));
    ok(rotulos[0].startsWith('Nome'), 'rótulo nome: ' + rotulos[0]);
    ok(rotulos[1].startsWith('O que ela gosta?'), 'rótulo gosto: ' + rotulos[1]);
    ok(rotulos[1].includes('qualquer cor'), 'ajuda curta');
    ok(rotulos[2].includes('Alguma observação?') && rotulos[2].includes('Opcional'), 'obs opcional');
    const opts = await page.locator('.preferencia-option').evaluateAll(bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    igual(opts, ['Mais econômico Priorizar menor preço', 'Melhor custo-benefício Equilíbrio entre preço e qualidade', 'Seguir sugestões da escola Priorizar marcas sugeridas', 'Maior qualidade Priorizar marcas melhores'], 'linhas de critério');
    igual(await page.evaluate(() => estado.rascunho.preferenciaGeral), 'economico', 'padrão');
    igual(await page.locator('.preferencia-option').first().getAttribute('aria-pressed'), 'true', 'aria-pressed padrão');
    await page.locator('.preferencia-option').nth(3).click();
    igual(await page.evaluate(() => estado.rascunho.preferenciaGeral), 'qualidade', 'valor interno preservado');
    igual(await page.locator('.preferencia-option').nth(3).getAttribute('aria-pressed'), 'true', 'aria-pressed novo');
    // a mensagem do WhatsApp continua usando o rótulo original
    await page.fill('#aluno-nome', 'Aluno');
    await page.fill('#aluno-cor', 'azul');
    const href = decodeURIComponent(await page.locator('#btn-enviar').getAttribute('href'));
    ok(href.includes('Critério para o orçamento: Marcas de maior qualidade'), 'WhatsApp usa o rótulo completo');
    // alturas: cada linha baixa
    const alturas = await page.locator('.preferencia-option').evaluateAll(bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
    ok(alturas.every(h => h <= 56), 'linhas compactas: ' + alturas);
    console.log('       alturas das linhas do critério (390px):', alturas.join(', '));
    await s.ctx.close();
  });

  await teste('B5 cards: sem "não informada"; marca sugerida só quando existe; "O que é este item?" preservado', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    const textoGrid = await page.locator('#itens-grid').innerText();
    ok(!/não informada/i.test(textoGrid), 'texto negativo ainda aparece');
    const comMarca = await page.locator('.item-card .marca-sugerida').count();
    igual(comMarca, ITENS_COM_MARCA, 'cards com marca sugerida');
    ok((await page.locator('.item-card .marca-sugerida').first().innerText()).includes('Tilibra'), 'marca existente aparece');
    igual(await page.locator('.item-card .item-img-buscar').count(), 8, 'link "O que é este item?" em todos');
    igual(await page.locator('.item-card .marca-preferencia-toggle').first().innerText(), '+ adicionar marca/preferência', 'ação opcional mantida');
    // continua funcionando: preferência por item + quantidade + inclusão
    await page.locator('.item-card .marca-preferencia-toggle').first().click();
    await page.locator('.item-card .marca-preferencia-input').first().fill('Faber-Castell');
    igual(await page.evaluate(() => estado.rascunho.itens[0].preferenciaCliente), 'Faber-Castell', 'preferência por item');
    await page.locator('.item-card [data-acao="mais"]').first().click();
    igual(await page.evaluate(() => estado.rascunho.itens[0].qty), 5, 'quantidade');
    await page.locator('.item-card [data-acao="excluir"]').first().click();
    igual(await page.locator('#counter-tem').innerText(), '1 não quero', 'contador');
    igual(await page.locator('#le-barra-itens').innerText(), '7 itens', 'barra compacta acompanha');
    igual(await page.locator('#btn-marcar-todos-tem').innerText(), 'Marcar todos como "Não quero"', 'rótulo do "marcar todos" (ainda há inclusos)');
    await page.click('#btn-marcar-todos-tem');
    igual(await page.locator('#btn-marcar-todos-tem').innerText(), 'Marcar todos como "Quero comprar"', 'rótulo sincronizado');
    igual(await page.locator('#le-barra-itens').innerText(), '0 itens', 'barra com 0');
    await s.ctx.close();
  });

  await teste('B6 mobile: guia curto da etapa 3 (Azul + chips) no lugar do texto longo', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    ok(await page.locator('.le-guia-corpo').isHidden(), 'texto longo escondido');
    igual(await page.locator('.le-guia-mob-titulo').innerText(), 'Só ajuste o que precisar.', 'título curto');
    igual(await page.locator('.le-chips li').allInnerTexts(), ['Quantidade', 'Tirar o que já tem', 'Marca ou preferência'], 'chips');
    ok(await page.locator('.le-guia-mascote').isVisible(), 'Azul visível');
    const h = await page.locator('.le-guia').evaluate(e => Math.round(e.getBoundingClientRect().height));
    console.log('       altura do guia (390px):', h);
    ok(h <= 110, 'guia compacto: ' + h);
    await s.ctx.close();
  });

  await teste('B7 mobile: progresso "Passo N de 4" acompanha a rolagem e as âncoras funcionam', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    const passo = () => page.locator('#le-passo-atual').innerText();
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250);
    igual(await passo(), 'Passo 1 de 4 · Conferir a lista', 'passo 1');
    await rolarPara(page, '#le-etapa-2', 'start');
    igual(await passo(), 'Passo 2 de 4 · Dados da criança', 'passo 2');
    await rolarPara(page, '#le-etapa-3', 'start');
    igual(await passo(), 'Passo 3 de 4 · Materiais', 'passo 3');
    await rolarPara(page, '#le-etapa-4', 'start');
    ok((await passo()).startsWith('Passo 4 de 4'), 'passo 4: ' + await passo());
    igual(await page.locator('.le-etapas a[aria-current="step"]').count(), 1, 'um passo atual');
    igual(await page.locator('.le-etapas-txt').nth(1).textContent(), 'Dados e critério', 'nome acessível da âncora (texto só oculto visualmente)');
    igual(await page.locator('.le-etapas-txt').nth(1).evaluate(e => { const r = e.getBoundingClientRect(); return r.width <= 1 && r.height <= 1; }), true, 'texto da âncora oculto visualmente');
    // âncora do passo 2 navega
    await page.locator('.le-etapas a').nth(1).click();
    await page.waitForTimeout(500);
    const topo = await page.locator('#le-etapa-2').evaluate(e => Math.round(e.getBoundingClientRect().top));
    ok(topo >= 100 && topo < 400, 'âncora leva à etapa 2 sem ficar sob o header/progresso (top=' + topo + ')');
    await s.ctx.close();
  });

  await teste('B8 mobile: barra compacta ~66px, "Continuar" leva ao envio, some quando o CTA completo aparece', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    ok(await page.locator('#le-barra').evaluate(e => e.classList.contains('visivel')), 'barra visível nos passos 1–3');
    const h = await page.locator('#le-barra').evaluate(e => Math.round(e.getBoundingClientRect().height));
    console.log('       altura da barra compacta (390px):', h);
    ok(h >= 56 && h <= 72, 'altura 56–72px: ' + h);
    igual(await page.locator('#le-barra .le-barra-btn').innerText(), 'Revisar e enviar', 'CTA da barra');
    // não duplica o CTA final: o link de WhatsApp não está na barra
    igual(await page.locator('#le-barra a').count(), 0, 'barra não tem o CTA do WhatsApp');
    await page.click('#btn-continuar');
    await page.waitForTimeout(900);
    const topo4 = await page.locator('#le-etapa-4').evaluate(e => Math.round(e.getBoundingClientRect().top));
    ok(topo4 < 300, 'foi para a etapa 4 (top=' + topo4 + ')');
    const cta = await page.locator('#btn-enviar').evaluate(e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
    ok(cta.top >= 0 && cta.bottom <= cta.vh, 'CTA completo visível: ' + JSON.stringify(cta));
    ok(!(await page.locator('#le-barra').evaluate(e => e.classList.contains('visivel'))), 'barra compacta some no envio');
    ok(await page.locator('#btn-recomecar').isVisible() && await page.locator('#btn-adicionar-lista').isVisible(), 'ações secundárias acessíveis abaixo');
    igual(await page.locator('#btn-enviar').innerText(), 'Enviar lista para orçamento', 'CTA completo');
    igual(await page.evaluate(() => getComputedStyle(document.querySelector('.acoes-finais')).position), 'static', 'sem sticky grande no mobile');
    // limpar pedido e adicionar nova lista continuam funcionando fora da barra
    await page.click('#btn-adicionar-lista');
    await page.waitForSelector('#estado-upload.ativo');
    await s.ctx.close();
  });

  await teste('B9 mobile: a barra não cobre campo em foco (some com o teclado) e não cobre campos em nenhuma rolagem', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    await page.focus('#aluno-cor');
    ok(!(await page.locator('#le-barra').evaluate(e => getComputedStyle(e).visibility === 'visible')), 'barra oculta com campo em foco');
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(100);
    // campos centralizados (como o app faz ao validar) nunca ficam sob a barra
    for (const sel of ['#aluno-nome', '#aluno-cor', '#aluno-obs', '#meta-escola']) {
      if (sel === '#meta-escola') await page.click('#meta-editar');
      await rolarPara(page, sel, 'center');
      const r = await page.evaluate((q) => {
        const el = document.querySelector(q).getBoundingClientRect(); const b = document.getElementById('le-barra');
        const vis = b.classList.contains('visivel') && getComputedStyle(b).visibility === 'visible';
        const br = b.getBoundingClientRect();
        return { vis, cobre: vis && el.bottom > br.top && el.top < br.bottom };
      }, sel);
      ok(!r.cobre, `${sel} coberto pela barra`);
    }
    // e a rolagem nativa de foco (sem blocos explícitos) respeita o scroll-padding
    const pad = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom);
    ok(parseInt(pad) >= 80, 'scroll-padding-bottom aplicado: ' + pad);
    await s.ctx.close();
  });

  await teste('B10 mobile: "Depois do envio" com <details> acessível por teclado; desktop mostra 4 cards', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    igual(await page.locator('.le-depois-mob h2').innerText(), 'Depois do envio', 'título');
    ok((await page.locator('.le-depois-mob p').innerText()).includes('manda seu orçamento pelo WhatsApp'), 'resumo');
    ok(await page.locator('.le-depois-det li').first().isHidden(), 'passos fechados');
    await page.locator('.le-depois-det summary').focus();
    await page.keyboard.press('Enter');
    ok(await page.locator('.le-depois-det li').first().isVisible(), 'abre com Enter');
    igual(await page.locator('.le-depois-det li').count(), 4, 'quatro passos');
    await page.keyboard.press('Space');
    ok(await page.locator('.le-depois-det li').first().isHidden(), 'fecha com Espaço');
    ok(await page.locator('.le-depois-desk').isHidden(), 'cards grandes escondidos no mobile');
    await s.ctx.close();
  });

  await teste('B11 Vermelho: acima do card, sem bloquear clique, sem cobrir campos/texto e sem overflow', async () => {
    for (const v of VIEWPORTS) {
      const s = await abrir(browser, base, { viewport: { width: v.w, height: v.h }, mobile: v.mobile });
      const { page } = s;
      await rolarPara(page, '#estado-upload', 'start');
      const r = await page.evaluate(() => {
        const m = document.querySelector('.le-upload-mascote');
        const mr = m.getBoundingClientRect();
        const card = document.querySelector('#estado-upload .form-card');
        const zM = +getComputedStyle(m).zIndex, zC = +getComputedStyle(card).zIndex;
        const inter = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const alvos = ['#nome', '#whatsapp', '#upload-area', '#btn-analisar', '.form-upload-intro strong', '.form-upload-intro p'];
        const cobertos = alvos.filter(q => { const e = document.querySelector(q); return e && inter(mr, e.getBoundingClientRect()); });
        // elementFromPoint ignora pointer-events:none; se achar o mascote, ele bloquearia o clique
        const pts = [[.25, .25], [.5, .5], [.75, .75], [.5, .9], [.9, .5]].map(([fx, fy]) => document.elementFromPoint(mr.left + mr.width * fx, mr.top + mr.height * fy));
        const bloqueia = pts.some(e => e && e.closest('.le-upload-mascote'));
        return { pe: getComputedStyle(m).pointerEvents, peImg: getComputedStyle(m.querySelector('img')).pointerEvents, zM, zC, cobertos, bloqueia, top: Math.round(mr.top), bottom: Math.round(mr.bottom), cardTop: Math.round(card.getBoundingClientRect().top), esquerda: Math.round(mr.left), direita: Math.round(mr.right), vw: innerWidth };
      });
      ok(r.pe === 'none' && r.peImg === 'none', `${v.w}: pointer-events ${r.pe}/${r.peImg}`);
      ok(r.zM > r.zC, `${v.w}: z-index do Vermelho (${r.zM}) deve ficar acima do card (${r.zC})`);
      igual(r.cobertos, [], `${v.w}: Vermelho cobre elementos`);
      ok(!r.bloqueia, `${v.w}: Vermelho bloqueia clique`);
      ok(r.direita <= r.vw + 1 && r.esquerda >= -1, `${v.w}: Vermelho fora da viewport (${r.esquerda}..${r.direita} de ${r.vw})`);
      ok(await overflowH(page) === null, `${v.w}: overflow horizontal`);
      await s.ctx.close();
    }
  });

  await teste('B12 mobile: o upload continua clicável por baixo do Vermelho (abre o seletor de arquivos)', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#upload-area').tap()]);
    ok(!!chooser, 'seletor aberto');
    await s.ctx.close();
  });

  await teste('B13 mobile: faixa L A Cabral mais fina que antes e autoria preservada', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    const h = await page.locator('.le-cabral .la-cabral-compact').evaluate(e => Math.round(e.getBoundingClientRect().height));
    console.log('       altura da faixa L A Cabral (390px):', h);
    ok(h <= 42, 'faixa fina: ' + h);
    ok(/L A Cabral/i.test(await page.locator('.le-cabral').textContent()), 'autoria preservada');
    await s.ctx.close();
  });

  await teste('B14 restauração: recarregar com pedido salvo volta à revisão, com barra e progresso funcionando', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    page.on('dialog', d => d.accept());
    await ateResultado(s);
    await page.fill('#aluno-nome', 'Aluno Restaurado');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#estado-resultado.ativo');
    ok(await page.locator('#pedido-salvo-banner').isVisible(), 'banner de restauração');
    igual(await page.locator('#aluno-nome').inputValue(), 'Aluno Restaurado', 'campo restaurado');
    igual(await page.locator('#meta-resumo-escola').innerText(), 'Centro Educacional Azim', 'resumo restaurado');
    await page.evaluate(() => window.scrollTo(0, 5)); await page.waitForTimeout(300);
    ok(/^Passo \d de 4/.test(await page.locator('#le-passo-atual').innerText()), 'progresso ativo');
    ok(await page.locator('#le-barra').evaluate(e => e.classList.contains('visivel')), 'barra visível');
    igual(await page.locator('#le-barra-itens').innerText(), '8 itens', 'contagem restaurada');
    igual(await page.evaluate(() => arquivosSelecionados.length), 0, 'coleção de arquivos não é restaurada (File não persiste)');
    await shot(page, 390, '12-restaurado');
    await s.ctx.close();
  });

  await teste('B15 uma lista e múltiplas listas no mobile: faixa, troca e total do pedido', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    await page.fill('#aluno-nome', 'Criança Um');
    await page.fill('#aluno-cor', 'azul');
    await page.click('#btn-adicionar-lista');
    await page.waitForSelector('#estado-upload.ativo');
    await page.setInputFiles('#arquivo', [fixture('seg1.png', 3000)]);
    await page.click('#btn-analisar');
    await page.waitForSelector('#estado-resultado.ativo');
    igual(s.envios, [2, 1], 'a 2ª criança enviou só o próprio arquivo');
    ok(await page.locator('.lista-faixa').count() === 1, 'faixa da lista 1');
    await page.fill('#aluno-nome', 'Criança Dois');
    await page.fill('#aluno-cor', 'rosa');
    await rolarPara(page, '#le-etapa-4', 'start');
    ok(/2 listas/.test(await page.locator('#bloco-pedido-resumo').innerText()), 'resumo com 2 listas');
    igual(await overflowH(page), null, 'sem scroll horizontal com 2 listas');
    await shot(page, 390, '13-duas-listas-envio');
    // trocar de lista
    await page.locator('.lista-faixa-btn').first().click();
    await page.waitForTimeout(300);
    igual(await page.locator('#aluno-nome').inputValue(), 'Criança Um', 'lista 1 reaberta');
    // validação: nome vazio na lista 2 bloqueia o envio
    await s.ctx.close();
  });

  await teste('B16 analytics: eventos da revisão não carregam dados pessoais', async () => {
    const s = await abrir(browser, base, { viewport: { width: 390, height: 844 }, mobile: true });
    const { page } = s;
    await ateResultado(s);
    await page.click('#meta-editar');
    await page.fill('#meta-escola', 'Escola Secreta XYZ');
    await page.click('#meta-editar');
    await page.fill('#aluno-nome', 'Joaquim Silveira');
    await page.fill('#aluno-cor', 'verde-limão');
    await page.fill('#aluno-obs', 'alergia a lápis XPTO');
    await page.locator('.item-card .marca-preferencia-toggle').first().click();
    await page.locator('.item-card .marca-preferencia-input').first().fill('marca-confidencial');
    await page.waitForTimeout(100); // o toggle devolve o foco ao campo via setTimeout(0)
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(100);
    await page.click('#btn-continuar');
    await page.waitForTimeout(700);
    const nomes = s.eventos.map(e => e.nome);
    ok(nomes.includes('school_list_continue_to_send'), 'evento novo da barra');
    ok(nomes.includes('school_list_upload_file_selected') && nomes.includes('school_list_analysis_completed'), 'eventos atuais preservados');
    const bruto = JSON.stringify(s.eventos);
    for (const proibido of ['Joaquim', 'Silveira', 'verde-limão', 'alergia', 'XPTO', 'marca-confidencial', 'Escola Secreta', 'Maria Teste', '12999998888', '99999-8888', 'b1.png', 'b2.png']) ok(!bruto.includes(proibido), `evento vazou "${proibido}"`);
    await s.ctx.close();
  });
}

const ITENS_COM_MARCA = 4; // Tilibra, Faber-Castell, BIC, UHU (ver fixtures de ITENS no e2e)
