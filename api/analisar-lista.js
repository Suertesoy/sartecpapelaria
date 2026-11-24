import { readFileSync } from 'fs';
import formidable from 'formidable';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

const TIPOS_ACEITOS       = ['image/jpeg', 'image/png', 'application/pdf'];
const LIMITE_BYTES        = 4 * 1024 * 1024;
const LIMITE_TOTAL_BYTES  = 20 * 1024 * 1024;
const MAX_ARQUIVOS        = 5;
const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const PROMPT_SISTEMA = `Você é um assistente especializado em leitura de listas escolares brasileiras para papelaria.

Sua tarefa é analisar o(s) arquivo(s) recebido(s) e retornar:
1. Metadados da lista (escola, ano/série, segmento, ano letivo)
2. Apenas os itens que a família provavelmente quer comprar ou pedir orçamento para a papelaria
3. Validação se os arquivos pertencem à mesma criança (validacaoConjunto)

━━━ METADADOS ━━━
Extraia do documento:
- escola: nome da escola, se aparecer
- anoSerie: ano e série (ex: "3º ano", "1ª série", "4º ano EF1")
- segmento: nível de ensino (ex: "Educação Infantil", "Ensino Fundamental I", "Ensino Médio")
- anoLetivo: ano letivo (ex: "2025", "2026")
Se não encontrar, deixe string vazia.

━━━ ITENS — O QUE INCLUIR ━━━
Inclua qualquer item que a família provavelmente compraria ou pediria orçamento:
- Materiais escolares clássicos: cadernos, lápis, canetas, borrachas, apontadores, réguas, esquadros, compassos, pastas, fichários, mochilas, estojos
- Artes e criatividade: tintas, pincéis, canetinhas, lápis de cor, massinha, EVA, papéis coloridos, tesouras, cola, fita adesiva
- Materiais de higiene solicitados para compra: papel higiênico, lenço de papel, copo descartável, sabonete, escova de dente, pasta dental, detergente
- Livros solicitados para compra pela família (preservar editora, ISBN e autor em obs)
- Qualquer outro item que a lista indique que a família deve adquirir

━━━ ITENS — O QUE IGNORAR COMPLETAMENTE ━━━
Não retorne nada que seja:
- Cabeçalho, título, nome da escola como item, comunicado, data, telefone, e-mail, assinatura
- Instrução geral aos pais: orientações de entrega, etiquetagem, reaproveitamento, normas da escola
- Itens claramente adquiridos ou fornecidos pela escola: frases como "adquirido na escola", "fornecido pela escola", "será encaminhado pela escola", "conforme circular específica", "valor conforme circular"
- Kits de conteúdo digital ou apostilas comprados diretamente na escola (ex: "Material Geekie One", "Kit de Timbrados", "Material Gráfico" quando o texto diz que é adquirido na escola)
- Uniformes, camisetas, aventais usados, de reaproveitamento ou de terceiro: "camiseta usada do ano anterior", "avental — quem tiver do ano passado pode enviar", "contato para uniforme: (12) XXXX"
- Orientações de reaproveitamento de materiais do ano anterior
- Qualquer trecho que seja claramente uma instrução, não um item a comprar

━━━ MARCA SUGERIDA ━━━
- Preencha marcaSugerida APENAS quando a lista mencionar explicitamente uma marca sugerida ou recomendada para aquele item.
- Não invente marca. Não infira marca.
- Se não houver marca mencionada para o item, retorne string vazia em marcaSugerida.
- Se a marca estiver no texto do item, separe: coloque a marca em marcaSugerida e mantenha em obs apenas características como cor, tamanho, número de folhas, gramatura, formato, quantidade por embalagem.
- Trate a marca como sugestão da escola, nunca como obrigação.

━━━ REGRAS DE EXTRAÇÃO ━━━
- Leia todas as páginas, colunas e seções em ordem. Use as divisões visuais e os títulos para entender a qual grupo cada material pertence.
- Quando houver recortes de uma foto, compare os recortes com a foto integral. São partes da mesma página, inclusive para validacaoConjunto. Use os recortes para ler palavras e números pequenos e a foto inteira para conferir a posição dos itens. Não duplique linhas visíveis em mais de uma imagem.
- Antes de responder, confira a quantidade no início de cada linha, inclusive quando vier após símbolos como # ou ◊. Zero à esquerda não muda o valor: "#03 Cadernos ... sendo 1 para inglês" pede 3 cadernos, com 1 dos 3 reservado para inglês.
- Transcreva a identidade do produto e preserve os termos da escola quando distinguirem materiais. Sulfitão branco e sulfite A4 são produtos distintos. Não troque um pelo outro nem deduza dimensões, gramatura ou finalidade. Sacos plásticos A4 com furos são sacos plásticos, não clipes nem parte da pasta da linha anterior. Cola bastão escolar não é refil de cola quente.
- Gere um item por produto ou variante com quantidade própria, inclusive quando há mais de um na mesma linha. "1 pincel macio nº 08 e 1 pincel duro nº 08 (cabo amarelo)" são dois itens de 1, cada um com suas especificações. "1 lápis 4B 1 tinta acrílica fosca, 37 ml" também são dois itens. Não coloque um produto em obs de outro.
- Se um título pedir um recipiente com materiais enumerados ("1 estojo com", "1 nécessaire com"), registre o recipiente e cada material listado como itens separados. Preserve as quantidades e não consolide pedidos do mesmo produto em seções diferentes. Quando a escola pede um produto vendido como conjunto ("1 estojo de canetinhas com 12 unidades", "1 caixa de lápis de cor com 24 unidades"), registre um item com quantidade 1 e o conteúdo da embalagem separado.
- qty é a quantidade pedida na unidade do documento. "500 folhas de sulfite A4" tem qty 500 e unidade folha. "200 copos descartáveis" tem qty 200 e unidade un. "1 resma de sulfite A4 com 500 folhas" tem qty 1, unidade resma e conteudoEmbalagem "500 folhas". Não converta folhas ou copos em embalagens quando o documento só pede unidades avulsas.
- Inclua no nome a unidade quando ela for necessária para entender a linha: "Folhas de sulfite A4", "Resma de sulfite A4", "Caixa de lápis de cor". Use conteudoEmbalagem apenas para a contagem de itens dentro de uma embalagem explícita. Não repita seu conteúdo em obs nem no nome. Use obs para especificações como "48 folhas" de um caderno ou "37 ml" de uma tinta.
- Preserve em obs as especificações ligadas a cada produto, como páginas de um caderno, tamanho, cor, medida e gramatura. Quando houver uma distribuição explícita por variantes, separe cada variante em sua própria linha. Exemplo: "4 folhas dupla face (2 pretas e 2 rosas)" vira duas linhas com qty 2 e as respectivas cores. Se o total divergir da distribuição ou houver cor possivelmente repetida por erro do documento, preserve os dados do original e sinalize a dúvida; não corrija por conta própria.
- Use qty null quando a quantidade estiver ausente, ambígua ou ilegível. Para qualquer dúvida de leitura, use confianca "baixa" e preencha trechoDuvidoso com o trecho legível do documento relacionado ao item, sem completar palavras por conta própria. Se a identidade do material estiver ilegível e houver risco de trocar o produto, use no nome somente o que for legível, por exemplo "Papel branco (tipo a confirmar)". Quando a leitura for clara, deixe trechoDuvidoso vazio.
- Retorne apenas JSON válido, sem markdown, sem texto antes ou depois.

━━━ VALIDAÇÃO DO CONJUNTO (obrigatório sempre) ━━━
Preencha validacaoConjunto com base em todos os arquivos analisados.

BLOQUEAR (mesmaCriancaProvavel: false, confianca: "alta") SOMENTE quando houver evidência clara:
- Escolas explicitamente diferentes entre os arquivos.
- Séries/anos claramente incompatíveis entre os arquivos.
- Dois conjuntos completos de lista de alunos diferentes com cabeçalhos incompatíveis.

NÃO BLOQUEAR em casos como:
- Seções internas da mesma lista: material individual, coletivo, artes, higiene, livros, uso diário, material que fica na escola.
- Páginas diferentes da mesma lista (página 1 + página 2).
- Lista regular + lista de artes da mesma escola e série.
- Um arquivo sem escola/série identificável e sem conflito com os demais.

CONFIANÇA: "alta" = evidência definitiva; "media" = suspeita sem certeza; "baixa" = dados insuficientes.
Se houver apenas 1 arquivo: mesmaCriancaProvavel: true, confianca: "alta", motivo: "Arquivo único".

━━━ SCHEMA OBRIGATÓRIO ━━━
{
  "metadados": {
    "escola": "",
    "anoSerie": "",
    "segmento": "",
    "anoLetivo": ""
  },
  "itens": [
    {
      "nome": "string",
      "qty": 1,
      "unidade": "un|folha|resma|caixa|conjunto|pacote|rolo|outro",
      "conteudoEmbalagem": "string",
      "obs": "string",
      "categoria": "string",
      "marcaSugerida": "string",
      "confianca": "alta|media|baixa",
      "trechoDuvidoso": "string"
    }
  ],
  "avisos": ["string"],
  "validacaoConjunto": {
    "mesmaCriancaProvavel": true,
    "confianca": "alta|media|baixa",
    "escolasIdentificadas": [],
    "seriesIdentificadas": [],
    "motivo": "string"
  }
}`;

const UNIDADES_VALIDAS = ['un', 'folha', 'resma', 'caixa', 'conjunto', 'pacote', 'rolo', 'outro'];

function gerarId(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function normalizarMetadados(meta) {
  if (!meta || typeof meta !== 'object') {
    return { escola: '', anoSerie: '', segmento: '', anoLetivo: '' };
  }
  return {
    escola:    typeof meta.escola    === 'string' ? meta.escola.trim()    : '',
    anoSerie:  typeof meta.anoSerie  === 'string' ? meta.anoSerie.trim()  : '',
    segmento:  typeof meta.segmento  === 'string' ? meta.segmento.trim()  : '',
    anoLetivo: typeof meta.anoLetivo === 'string' ? meta.anoLetivo.trim() : '',
  };
}

export function normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens
    .filter(it => it && typeof it.nome === 'string' && it.nome.trim())
    .map((it, index) => {
      const nome = it.nome.trim();
      const quantidade = typeof it.qty === 'string' && /^\d+$/.test(it.qty.trim()) ? Number(it.qty) : it.qty;
      const qty = Number.isSafeInteger(quantidade) && quantidade > 0 ? quantidade : null;
      const trechoDuvidoso = typeof it.trechoDuvidoso === 'string' ? it.trechoDuvidoso.trim() : '';

      return {
        id: `${gerarId(nome)}_${index + 1}`,
        nome,
        qty,
        unidade: UNIDADES_VALIDAS.includes(it.unidade) ? it.unidade : 'un',
        conteudoEmbalagem: typeof it.conteudoEmbalagem === 'string' ? it.conteudoEmbalagem.trim() : '',
        obs: typeof it.obs === 'string' ? it.obs.trim() : '',
        categoria: typeof it.categoria === 'string' ? it.categoria.trim() : 'geral',
        marcaSugerida: typeof it.marcaSugerida === 'string' ? it.marcaSugerida.trim() : '',
        confianca: qty === null || trechoDuvidoso ? 'baixa' : normalizarConfianca(it.confianca),
        trechoDuvidoso,
      };
    });
}

function normalizarConfianca(confianca) {
  return ['alta', 'media', 'baixa'].includes(confianca) ? confianca : 'media';
}

function normalizarValidacaoConjunto(vc) {
  if (!vc || typeof vc !== 'object') {
    return { mesmaCriancaProvavel: true, confianca: 'alta', escolasIdentificadas: [], seriesIdentificadas: [], motivo: '' };
  }
  return {
    mesmaCriancaProvavel: vc.mesmaCriancaProvavel !== false,
    confianca:            ['alta', 'media', 'baixa'].includes(vc.confianca) ? vc.confianca : 'baixa',
    escolasIdentificadas: Array.isArray(vc.escolasIdentificadas) ? vc.escolasIdentificadas.map(String) : [],
    seriesIdentificadas:  Array.isArray(vc.seriesIdentificadas)  ? vc.seriesIdentificadas.map(String)  : [],
    motivo:               typeof vc.motivo === 'string' ? vc.motivo.trim() : '',
  };
}

function blocoImagem(data, mimetype) {
  return { type: 'image', source: { type: 'base64', media_type: mimetype, data: data.toString('base64') } };
}

// Zooms sobrepostos ajudam em páginas grandes cujo texto fica pequeno na imagem inteira.
export async function recortarPagina(data) {
  const imagem = sharp(data);
  const { autoOrient: { width, height } } = await imagem.metadata();
  if (width < 1100 || height < 1300) return [];

  const orientada = await imagem.autoOrient().jpeg({ quality: 94 }).toBuffer();
  const largura = Math.ceil(width * 0.58);
  const altura = Math.ceil(height * 0.58);
  const recortes = [
    { nome: 'superior esquerdo', left: 0, top: 0 },
    { nome: 'superior direito', left: width - largura, top: 0 },
    { nome: 'inferior esquerdo', left: 0, top: height - altura },
    { nome: 'inferior direito', left: width - largura, top: height - altura },
  ];

  return Promise.all(recortes.map(async ({ nome, left, top }) => ({
    nome,
    imagem: await sharp(orientada)
      .extract({ left, top, width: largura, height: altura })
      .resize({ width: 1150, height: 1150, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer(),
  })));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: 'API de IA não configurada no servidor.' });
  }

  // Parse multipart/form-data — múltiplos arquivos no campo "arquivo"
  const form = formidable({ maxFileSize: LIMITE_BYTES });
  let arquivos;
  try {
    const [, files] = await form.parse(req);
    const raw = files?.arquivo;
    arquivos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  } catch (err) {
    const ehTamanho = err.code === 1009 || String(err.message).includes('maxFileSize');
    return res.status(400).json({
      ok: false,
      error: ehTamanho
        ? 'Arquivo muito grande. Máximo por arquivo: 4MB.'
        : 'Erro ao processar os arquivos enviados.',
    });
  }

  if (!arquivos.length) {
    return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado. Envie o campo "arquivo".' });
  }
  if (arquivos.length > MAX_ARQUIVOS) {
    return res.status(400).json({ ok: false, error: `Envie no máximo ${MAX_ARQUIVOS} arquivos por análise.` });
  }

  let totalBytes = 0;
  for (const arq of arquivos) {
    if (!TIPOS_ACEITOS.includes(arq.mimetype)) {
      return res.status(400).json({ ok: false, error: `Arquivo "${arq.originalFilename}" não aceito. Envie JPG, PNG ou PDF.` });
    }
    if (arq.size > LIMITE_BYTES) {
      return res.status(400).json({ ok: false, error: `O arquivo "${arq.originalFilename}" é maior que 4MB. Reduza o tamanho e tente novamente.` });
    }
    totalBytes += arq.size;
  }
  if (totalBytes > LIMITE_TOTAL_BYTES) {
    return res.status(400).json({ ok: false, error: `O conjunto ultrapassou ${Math.round(LIMITE_TOTAL_BYTES / (1024 * 1024))}MB. Reduza o tamanho ou envie menos arquivos.` });
  }

  const contentBlocks = [];
  for (const [index, arq] of arquivos.entries()) {
    const data = readFileSync(arq.filepath);
    const numero = index + 1;
    if (arq.mimetype === 'application/pdf') {
      contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data.toString('base64') } });
      continue;
    }

    contentBlocks.push({ type: 'text', text: `Imagem integral do arquivo ${numero}.` }, blocoImagem(data, arq.mimetype));
    try {
      const recortes = await recortarPagina(data);
      for (const recorte of recortes) {
        contentBlocks.push(
          { type: 'text', text: `Zoom do canto ${recorte.nome} do arquivo ${numero}. É parte da mesma imagem integral.` },
          blocoImagem(recorte.imagem, 'image/jpeg'),
        );
      }
    } catch {
      console.warn('[analisar-lista] Não foi possível ampliar a imagem. A análise usará a imagem integral.');
    }
  }
  const qtd = arquivos.length;
  contentBlocks.push({
    type: 'text',
    text: qtd === 1
      ? 'Analise esta lista escolar e retorne os metadados, os itens para orçamento e validacaoConjunto conforme o schema.'
      : `Analise estes ${qtd} arquivos de lista escolar como um conjunto. Extraia todos os itens, preencha metadados consolidados e avalie em validacaoConjunto se os arquivos parecem ser da mesma criança.`,
  });

  let respostaTexto;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODELO,
      max_tokens: 8192,
      system: PROMPT_SISTEMA,
      messages: [{ role: 'user', content: contentBlocks }],
    });
    if (msg.stop_reason === 'max_tokens') {
      return res.status(422).json({
        ok: false,
        error: 'A lista ficou longa demais para conferir por inteiro. Tente analisar menos páginas por vez.',
      });
    }
    respostaTexto = msg.content?.[0]?.text ?? '';
  } catch (err) {
    console.error('[analisar-lista] Erro Anthropic:', err.message);
    return res.status(502).json({ ok: false, error: 'Erro ao processar com IA. Tente novamente em instantes.' });
  }

  let dados;
  try {
    const match = respostaTexto.match(/\{[\s\S]*\}/);
    dados = JSON.parse(match ? match[0] : respostaTexto);
  } catch {
    console.error('[analisar-lista] Resposta não-JSON da IA');
    return res.status(502).json({ ok: false, error: 'A IA retornou um formato inesperado. Tente novamente.' });
  }

  const metadados          = normalizarMetadados(dados.metadados);
  const itens              = normalizarItens(dados.itens);
  const avisos             = Array.isArray(dados.avisos)
    ? dados.avisos.filter(a => typeof a === 'string').slice(0, 5)
    : [];
  const validacaoConjunto  = normalizarValidacaoConjunto(dados.validacaoConjunto);

  if (itens.length === 0) {
    return res.status(200).json({
      ok: false,
      metadados,
      validacaoConjunto,
      error: 'Não consegui identificar itens para orçamento nesta lista. Tente enviar uma foto mais nítida ou um PDF.',
    });
  }

  return res.status(200).json({ ok: true, metadados, itens, avisos, validacaoConjunto });
}
