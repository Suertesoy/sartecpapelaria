import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(3);

const colas = makeItems('cola', 'colasFitas', v, [
  ['cola_bastao', 'Cola bastão', { tags: ['cola_bastao'], desc: 'Para papel, cartolina e atividades escolares.' }],
  ['cola_branca', 'Cola branca', { tags: ['cola_branca'] }],
  ['cola_instantanea', 'Cola instantânea'],
  ['cola_quente', 'Cola quente', { tags: ['cola_quente'] }],
  ['cola_de_silicone', 'Cola de silicone'],
  ['cola_para_eva_isopor', 'Cola para EVA e isopor', { tags: ['cola_eva_isopor'], syn: ['cola_isopor'] }],
  ['cola_para_madeira', 'Cola para madeira'],
  ['cola_para_tecido', 'Cola para tecido'],
  ['cola_para_artesanato', 'Cola para artesanato'],
]);

const fitasAdesivas = makeItems('fita', 'colasFitas', v, [
  ['fita_adesiva_transparente', 'Fita adesiva transparente', { tags: ['fita_adesiva_transparente'], syn: ['durex', 'fita_durex'] }],
  ['fita_adesiva_colorida', 'Fita adesiva colorida'],
  ['fita_dupla_face', 'Fita dupla face'],
  ['fita_crepe', 'Fita crepe'],
  ['fita_para_embalagem', 'Fita para embalagem', { tags: ['fita_embalagem'] }],
  ['fita_isolante', 'Fita isolante'],
]);

const adesivosEtiquetas = makeItems('etiqueta', 'simples', v, [
  ['etiqueta_para_impressao', 'Etiqueta para impressão', { tags: ['etiqueta_impressao'] }],
  ['etiqueta_de_preco', 'Etiqueta de preço'],
  ['etiqueta_escolar', 'Etiqueta escolar', { tags: ['etiqueta_escolar'] }],
  ['adesivo_decorativo', 'Adesivo decorativo', { tags: ['adesivo_decorativo'] }],
  ['etiquetas_em_geral', 'Etiquetas em geral', { tags: ['etiqueta'] }],
]);

const correcao = makeItems('correcao', 'simples', v, [
  ['borracha', 'Borracha', { tags: ['borracha'], syn: ['borracha_de_apagar'] }],
  ['corretivo_em_fita', 'Corretivo em fita', { tags: ['corretivo'] }],
  ['corretivo_liquido', 'Corretivo líquido', { tags: ['corretivo'] }],
  ['caneta_corretiva', 'Caneta corretiva'],
]);

export const CATEGORY_COLAS_FITAS_ADESIVOS_CORRECAO = makeCategory(
  'colas-fitas-adesivos-correcao',
  'Colas, fitas, adesivos e correção',
  'Colas para todo tipo de uso, fitas adesivas, etiquetas e itens de correção.',
  4,
  true,
  [
    makeSubcategory('colas', 'Colas', 1, colas),
    makeSubcategory('fitas-adesivas', 'Fitas adesivas', 2, fitasAdesivas),
    makeSubcategory('adesivos-etiquetas', 'Adesivos e etiquetas', 3, adesivosEtiquetas),
    makeSubcategory('correcao', 'Correção', 4, correcao),
  ],
);
