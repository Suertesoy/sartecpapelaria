import { readFileSync } from 'fs';
import formidable from 'formidable';
import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: false } };

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf'];
const LIMITE_BYTES = 4 * 1024 * 1024;
const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const PROMPT_SISTEMA = `Você é um assistente especializado em leitura de listas escolares brasileiras.

Analise a imagem ou documento recebido e extraia todos os itens de material escolar, papelaria, escritório ou artes mencionados.

Regras:
- Extraia apenas itens compráveis: materiais escolares, papelaria, escritório, artes.
- Ignore completamente: nome da escola, turma, ano, série, cabeçalhos, datas, comunicados, observações gerais, instruções para pais, assinaturas, textos de rodapé.
- Para cada item, identifique a quantidade. Se não estiver explícita, use 1.
- Preserve detalhes relevantes em "obs": número de folhas, capa dura ou brochura, cores, tamanho, gramatura, marca exigida, formato, quantidade por embalagem, obrigatório ou opcional.
- Não invente itens. Não invente marcas.
- Se estiver incerto sobre um item, inclua-o com confianca "baixa" e explique a dúvida em "obs".
- Não inclua vestuário, alimentos, eletrônicos ou itens não escolares.
- Retorne apenas JSON válido, sem markdown, sem texto antes ou depois do JSON.

Schema de resposta obrigatório:
{
  "itens": [
    {
      "nome": "string",
      "qty": 1,
      "obs": "string",
      "categoria": "string",
      "confianca": "alta|media|baixa"
    }
  ],
  "avisos": ["string"]
}`;

function gerarId(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens
    .filter(it => it && typeof it.nome === 'string' && it.nome.trim())
    .slice(0, 80)
    .map(it => ({
      id: gerarId(it.nome.trim()),
      nome: it.nome.trim(),
      qty: Math.min(Math.max(Math.round(Number(it.qty) || 1), 1), 99),
      obs: typeof it.obs === 'string' ? it.obs.trim() : '',
      categoria: typeof it.categoria === 'string' ? it.categoria.trim() : 'geral',
      confianca: ['alta', 'media', 'baixa'].includes(it.confianca) ? it.confianca : 'media',
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

  // Ler arquivo como base64
  const base64 = readFileSync(arquivo.filepath).toString('base64');

  // Montar bloco de conteúdo para Anthropic (imagem ou documento PDF)
  const blocoArquivo = arquivo.mimetype === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: arquivo.mimetype, data: base64 } };

  // Chamar Anthropic
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
            { type: 'text', text: 'Extraia todos os itens de material escolar desta lista.' },
          ],
        },
      ],
    });
    respostaTexto = msg.content?.[0]?.text ?? '';
  } catch (err) {
    console.error('[analisar-lista] Erro Anthropic:', err.message);
    return res.status(502).json({ ok: false, error: 'Erro ao processar com IA. Tente novamente em instantes.' });
  }

  // Parsear JSON da resposta da IA
  let dados;
  try {
    const match = respostaTexto.match(/\{[\s\S]*\}/);
    dados = JSON.parse(match ? match[0] : respostaTexto);
  } catch {
    console.error('[analisar-lista] Resposta não-JSON da IA:', respostaTexto.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'A IA retornou um formato inesperado. Tente novamente.' });
  }

  const itens = normalizarItens(dados.itens);
  const avisos = Array.isArray(dados.avisos) ? dados.avisos.filter(a => typeof a === 'string') : [];

  if (itens.length === 0) {
    return res.status(200).json({
      ok: false,
      error: 'Não consegui identificar itens na lista. Tente enviar uma foto mais nítida ou um PDF.',
    });
  }

  return res.status(200).json({ ok: true, itens, avisos });
}
