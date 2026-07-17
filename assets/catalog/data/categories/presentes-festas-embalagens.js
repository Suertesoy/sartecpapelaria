import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(9);
const P = 'complementar';

const embalagensPresente = makeItems('presente', 'presentes', v, [
  ['sacola_de_presente', 'Sacola de presente', { tags: ['sacola_presente'] }],
  ['saco_de_presente', 'Saco de presente'],
  ['caixa_de_presente', 'Caixa de presente', { tags: ['caixa_presente'] }],
  ['papel_de_presente', 'Papel de presente', { tags: ['papel_presente'] }],
], P);

const fitasAcabamento = makeItems('fita_presente', 'presentes', v, [
  ['fita_decorativa', 'Fita decorativa', { tags: ['fita_decorativa'] }],
  ['fitilho', 'Fitilho'],
  ['laco', 'Laço', { tags: ['laco'] }],
  ['acessorios_de_acabamento', 'Acessórios de acabamento'],
], P);

const festaDecoracao = makeItems('festa', 'presentes', v, [
  ['balao_bexiga', 'Balão e bexiga'],
  ['artigo_para_festa', 'Artigo para festa'],
], P);

const embalagensDiversas = makeItems('embalagem', 'organizacao', v, [
  ['saco_para_embalagem', 'Saco para embalagem'],
  ['caixa_para_embalagem', 'Caixa para embalagem', { tags: ['caixa_embalagem'] }],
  ['plastico_bolha', 'Plástico bolha', { tags: ['plastico_bolha'] }],
  ['embalagem_em_geral', 'Embalagem em geral'],
], P);

const cartoesLembrancas = makeItems('lembranca', 'presentes', v, [
  ['cartao_de_mensagem', 'Cartão de mensagem', { tags: ['cartao_mensagem'] }],
  ['chaveiro', 'Chaveiro'],
  ['lembranca', 'Lembrança'],
], P);

export const CATEGORY_PRESENTES_FESTAS_EMBALAGENS = makeCategory(
  'presentes-festas-embalagens',
  'Presentes, festas e embalagens',
  'Embalagens para presente, fitas, itens de festa e cartões de mensagem.',
  10,
  false,
  [
    makeSubcategory('embalagens-presente', 'Embalagens para presente', 1, embalagensPresente),
    makeSubcategory('fitas-acabamento', 'Fitas e acabamento', 2, fitasAcabamento),
    makeSubcategory('festa-decoracao', 'Festa e decoração', 3, festaDecoracao),
    makeSubcategory('embalagens-diversas', 'Embalagens diversas', 4, embalagensDiversas),
    makeSubcategory('cartoes-lembrancas', 'Cartões e lembranças', 5, cartoesLembrancas),
  ],
);
