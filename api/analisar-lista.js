import { readFileSync } from 'fs';
import formidable from 'formidable';
import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: false } };

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf'];
const LIMITE_BYTES = 4 * 1024 * 1024;
const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const PROMPT_SISTEMA = `Você é um assistente especializado em leitura de listas escolares brasileiras para papelaria.

Sua tarefa é analisar a lista recebida e retornar dois blocos:
1. Metadados da lista (escola, ano/série, segmento, ano letivo)
2. Apenas os itens que a família provavelmente quer comprar ou pedir orçamento para a papelaria

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
- Não invente itens.
- Preserve em obs: número de folhas, capa dura/brochura, cor, tamanho, gramatura, formato, quantidade por embalagem, obrigatório/opcional (exceto marca, que vai em marcaSugerida).
- Quando não houver quantidade clara, use 1.
- Se um item puder ser comprado mas houver dúvida, inclua com confianca "baixa".
- Retorne apenas JSON válido, sem markdown, sem texto antes ou depois.

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
      "unidade": "un|caixa|conjunto|pacote|rolo|outro",
      "obs": "string",
      "categoria": "string",
      "marcaSugerida": "string",
      "confianca": "alta|media|baixa"
    }
  ],
  "avisos": ["string"]
}`;

const UNIDADES_VALIDAS = ['un', 'caixa', 'conjunto', 'pacote', 'rolo', 'outro'];

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

function normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens
    .filter(it => it && typeof it.nome === 'string' && it.nome.trim())
    .slice(0, 80)
    .map(it => ({
      id:            gerarId(it.nome.trim()),
      nome:          it.nome.trim(),
      qty:           Math.min(Math.max(Math.round(Number(it.qty) || 1), 1), 99),
      unidade:       UNIDADES_VALIDAS.includes(it.unidade) ? it.unidade : 'un',
      obs:           typeof it.obs           === 'string' ? it.obs.trim()           : '',
      categoria:     typeof it.categoria     === 'string' ? it.categoria.trim()     : 'geral',
      marcaSugerida: typeof it.marcaSugerida === 'string' ? it.marcaSugerida.trim() : '',
      confianca:     ['alta', 'media', 'baixa'].includes(it.confianca) ? it.confianca : 'media',
    }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: 'API de IA não configurada no servidor.' });
  }

  // Parse multipart/form-data
  const form = formidable({ maxFileSize: LIMITE_BYTES });
  let arquivo;
  try {
    const [, files] = await form.parse(req);
    arquivo = files?.arquivo?.[0];
  } catch (err) {
    const ehTamanho = err.code === 1009 || String(err.message).includes('maxFileSize');
    return res.status(400).json({
      ok: false,
      error: ehTamanho ? 'Arquivo muito grande. Máximo permitido: 4MB.' : 'Erro ao processar o arquivo enviado.',
    });
  }

  if (!arquivo) {
    return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado. Envie o campo "arquivo".' });
  }
  if (!TIPOS_ACEITOS.includes(arquivo.mimetype)) {
    return res.status(400).json({ ok: false, error: 'Tipo de arquivo não aceito. Envie JPG, PNG ou PDF.' });
  }
  if (arquivo.size > LIMITE_BYTES) {
    return res.status(400).json({ ok: false, error: 'Arquivo muito grande. Máximo permitido: 4MB.' });
  }

  const base64 = readFileSync(arquivo.filepath).toString('base64');

  const blocoArquivo = arquivo.mimetype === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: arquivo.mimetype, data: base64 } };

  let respostaTexto;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODELO,
      max_tokens: 4096,
      system: PROMPT_SISTEMA,
      messages: [
        {
          role: 'user',
          content: [
            blocoArquivo,
            { type: 'text', text: 'Analise esta lista escolar e retorne os metadados e os itens para orçamento conforme o schema.' },
          ],
        },
      ],
    });
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
    console.error('[analisar-lista] Resposta não-JSON da IA:', respostaTexto.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'A IA retornou um formato inesperado. Tente novamente.' });
  }

  const metadados = normalizarMetadados(dados.metadados);
  const itens = normalizarItens(dados.itens);
  const avisos = Array.isArray(dados.avisos)
    ? dados.avisos.filter(a => typeof a === 'string').slice(0, 5)
    : [];

  if (itens.length === 0) {
    return res.status(200).json({
      ok: false,
      metadados,
      error: 'Não consegui identificar itens para orçamento nesta lista. Tente enviar uma foto mais nítida ou um PDF.',
    });
  }

  return res.status(200).json({ ok: true, metadados, itens, avisos });
}
