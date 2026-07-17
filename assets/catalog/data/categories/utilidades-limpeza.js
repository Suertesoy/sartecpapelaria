import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(13);
const P = 'complementar';

const descartaveis = makeItems('descartavel', 'simples', v, [
  ['copo_descartavel', 'Copo descartável'],
  ['guardanapo', 'Guardanapo'],
  ['canudo', 'Canudo'],
], P);

const limpeza = makeItems('limpeza', 'organizacao', v, [
  ['produto_de_limpeza', 'Produto de limpeza'],
  ['acessorio_de_limpeza', 'Acessório de limpeza'],
  ['saco_de_lixo', 'Saco de lixo'],
], P);

const organizacaoDomestica = makeItems('domestico', 'organizacao', v, [
  ['pote', 'Pote'],
  ['cesto', 'Cesto'],
], P);

const utilidades = makeItems('utilidade', 'simples', v, [
  ['capa_de_chuva', 'Capa de chuva'],
  ['utilidade_diversa', 'Utilidade diversa'],
], P);

export const CATEGORY_UTILIDADES_LIMPEZA = makeCategory(
  'utilidades-limpeza',
  'Utilidades e limpeza',
  'Descartáveis, produtos de limpeza e utilidades para casa.',
  14,
  false,
  [
    makeSubcategory('descartaveis', 'Descartáveis', 1, descartaveis),
    makeSubcategory('limpeza', 'Limpeza', 2, limpeza),
    makeSubcategory('organizacao-domestica', 'Organização doméstica', 3, organizacaoDomestica),
    makeSubcategory('utilidades', 'Utilidades', 4, utilidades),
  ],
);
