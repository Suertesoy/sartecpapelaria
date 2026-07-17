/* ======================================================
   SARTEC — Catálogo — Montagem da mensagem de orçamento
   Gera o texto enviado ao WhatsApp a partir da lista.
   Reaproveita montarWpp() e SARTEC.WPP_PRINCIPAL de app.js
   — nenhum número novo é criado aqui.
   ====================================================== */

import { getItemById, getAttributeProfile } from './data/catalog-data.js';

const DELIVERY_LABELS = {
  retirada: 'retirada na loja',
  entrega: 'entrega',
  indefinido: 'ainda não sei',
};

function formatAttributeLines(catalogItemId, attributes) {
  if (!catalogItemId) return [];
  const item = getItemById(catalogItemId);
  if (!item) return [];
  const profile = getAttributeProfile(item.attributeProfile);
  const lines = [];
  for (const field of profile.fields) {
    if (field.type === 'quantity' || field.id === 'observacao') continue;
    const valor = attributes?.[field.id];
    if (valor === undefined || valor === null) continue;
    const texto = String(valor).trim();
    if (!texto || texto === 'Sem preferência') continue;
    lines.push(`${field.label}: ${texto}`);
  }
  return lines;
}

function formatManualLines(entry) {
  const lines = [];
  if (entry.attributes?.cor) lines.push(`Cor: ${entry.attributes.cor}`);
  if (entry.attributes?.especificacao) lines.push(`Tamanho ou especificação: ${entry.attributes.especificacao}`);
  return lines;
}

/**
 * @param {{ items: import('./catalog-list.js').CatalogListItem[], generalNote?: string, deliveryPreference?: 'retirada'|'entrega'|'indefinido' }} params
 */
export function buildQuoteMessage({ items, generalNote, deliveryPreference }) {
  const catalogItems = items.filter((it) => !it.manual);
  const manualItems = items.filter((it) => it.manual);
  const blocos = [];

  catalogItems.forEach((entry, idx) => {
    const linhas = [
      `${idx + 1}. ${entry.name}`,
      `Quantidade: ${entry.quantity}`,
      ...formatAttributeLines(entry.catalogItemId, entry.attributes),
    ];
    if (entry.notes) linhas.push(`Observação: ${entry.notes}`);
    blocos.push(linhas.join('\n'));
  });

  if (manualItems.length > 0) {
    const header = manualItems.length > 1 ? 'Itens adicionados manualmente:' : 'Item adicionado manualmente:';
    const manualBlocos = manualItems.map((entry) => {
      const linhas = [entry.name, `Quantidade: ${entry.quantity}`, ...formatManualLines(entry)];
      if (entry.notes) linhas.push(`Observação: ${entry.notes}`);
      return linhas.join('\n');
    });
    blocos.push([header, '', manualBlocos.join('\n\n')].join('\n'));
  }

  const rodape = [];
  if (generalNote && generalNote.trim()) rodape.push(`Observação geral: ${generalNote.trim()}`);
  rodape.push(`Preferência de recebimento: ${DELIVERY_LABELS[deliveryPreference] || DELIVERY_LABELS.indefinido}.`);

  return [
    '[SITE_CATALOGO_ORCAMENTO]',
    'Olá, montei uma lista de produtos pelo site da Sartec e gostaria de solicitar um orçamento.',
    blocos.join('\n\n'),
    rodape.join('\n'),
  ].filter(Boolean).join('\n\n');
}

/** Monta a URL final do WhatsApp reaproveitando o helper global montarWpp() de app.js. */
export function buildQuoteWhatsappUrl(message) {
  if (typeof window.montarWpp !== 'function' || !window.SARTEC?.WPP_PRINCIPAL) {
    // Falha ao montar a URL (app.js não carregado) — fallback direto, sem número novo hardcoded.
    return null;
  }
  return window.montarWpp(window.SARTEC.WPP_PRINCIPAL, message);
}
