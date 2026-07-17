/* ======================================================
   SARTEC — Catálogo — Sinônimos de busca
   Mapeia termos populares/coloquiais para o id canônico
   do item no catálogo. Usado pela busca antes de cair
   para comparação direta de nome/tags/categoria.
   ====================================================== */

export const SEARCH_SYNONYMS = {
  canetinha: 'caneta_hidrografica',
  canetinhas: 'caneta_hidrografica',
  hidrocor: 'caneta_hidrografica',
  durex: 'fita_adesiva_transparente',
  fita_durex: 'fita_adesiva_transparente',
  contact: 'plastico_adesivo',
  plastico_contact: 'plastico_adesivo',
  lapis_de_escrever: 'lapis_grafite',
  lapis_preto: 'lapis_grafite',
  papel_a4: 'papel_sulfite',
  sulfite_a4: 'papel_sulfite',
  borracha_de_apagar: 'borracha',
  pasta_arquivo: 'pasta_az',
  pasta_arquivo_morto: 'caixa_arquivo',
  caneta_para_quadro: 'marcador_quadro_branco',
  caneta_quadro_branco: 'marcador_quadro_branco',
  pincel_atomico: 'marcador_permanente',
  caneta_permanente: 'marcador_permanente',
  cola_isopor: 'cola_eva_isopor',
  giz_de_lousa: 'giz_para_quadro',
  clipe: 'clips',
  clipes: 'clips',
  grampo_de_grampeador: 'grampo',
  isopor_bolinha: 'isopor',
  fichario_argolas: 'fichario',
  mochila_de_rodinhas: 'mochila_escolar',
  mochila_costas: 'mochila_escolar',
  estojo_de_lapis: 'estojo_escolar',
  agenda_2026: 'agenda',
  caderno_10_materias: 'caderno_universitario_10_materias',
  caderno_1_materia: 'caderno_universitario_1_materia',
  pincel_para_pintura: 'pincel_artistico',
  tinta_para_pintar: 'tinta_guache',
  massinha: 'massa_de_modelar',
  massinha_de_modelar: 'massa_de_modelar',
  cx_som: 'caixa_de_som',
  pendrive: 'pen_drive',
  pen_drive_usb: 'pen_drive',
  toner_impressora: 'toner',
  cartucho_impressora: 'cartucho',
  refil_de_tinta: 'refil_tinta_impressora',
  esferografica: 'caneta_esferografica',
  bic: 'caneta_esferografica',
  marca_texto_pastel: 'marca_texto',
  regua_30cm: 'regua',
  papel_crepe: 'papel_crepom',
  eva: 'eva_liso',
  cola_quente_bastao: 'cola_quente',
  furador: 'perfurador',
  grampeador_de_mesa: 'grampeador',
};

/**
 * Normaliza um termo de busca: minúsculas, sem acento, sem pontuação
 * duplicada, espaços/traços colapsados em underscore.
 * @param {string} termo
 */
export function normalizarTermo(termo) {
  return (termo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_');
}

/** Resolve um termo digitado para um id canônico de item, se houver sinônimo direto. */
export function resolverSinonimo(termo) {
  const chave = normalizarTermo(termo);
  return SEARCH_SYNONYMS[chave] || null;
}

/** Normaliza texto livre para comparação (minúsculas, sem acento, sem pontuação), preservando espaços entre palavras. */
export function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra um texto normalizado em palavras individuais. */
export function tokenize(str) {
  return normalizeText(str).split(' ').filter(Boolean);
}
