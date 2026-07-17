import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(2);

const papeis = makeItems('papel', 'papeis', v, [
  ['papel_sulfite', 'Papel sulfite', { tags: ['papel_sulfite'], syn: ['papel_a4', 'sulfite_a4'], desc: 'Folhas brancas para impressão, cópias e atividades.' }],
  ['cartolina', 'Cartolina', { tags: ['cartolina'] }],
  ['papel_cartao', 'Papel cartão'],
  ['papel_crepom', 'Papel crepom', { syn: ['papel_crepe'] }],
  ['papel_para_dobradura', 'Papel para dobradura'],
  ['papel_seda', 'Papel seda', { tags: ['papel_seda'] }],
  ['papel_celofane', 'Papel celofane'],
  ['papel_carbono', 'Papel carbono'],
  ['papel_kraft', 'Papel kraft'],
  ['papel_vegetal', 'Papel vegetal'],
  ['papel_fotografico', 'Papel fotográfico'],
  ['papel_couche', 'Papel couchê'],
  ['papel_adesivo', 'Papel adesivo'],
  ['papel_colorido_criativo', 'Papel colorido e criativo', { tags: ['papel_colorido'] }],
]);

const papeisDesenho = makeItems('papel_desenho', 'papeis', v, [
  ['bloco_de_desenho', 'Bloco de desenho', { tags: ['bloco_desenho'] }],
  ['bloco_trabalhos_escolares', 'Bloco para trabalhos escolares'],
]);

const evaItems = makeItems('eva', 'simples', v, [
  ['eva_liso', 'EVA liso', { syn: ['eva'] }],
  ['eva_com_glitter', 'EVA com glitter'],
  ['eva_atoalhado', 'EVA atoalhado'],
  ['eva_estampado', 'EVA estampado'],
]);

const isopor = makeItems('isopor', 'simples', v, [
  ['isopor', 'Isopor', { syn: ['isopor_bolinha'] }],
]);

const plasticosRevestimentos = makeItems('plastico', 'simples', v, [
  ['plastico_adesivo_contact', 'Plástico adesivo e contact', { tags: ['plastico_adesivo'], syn: ['contact', 'plastico_contact'] }],
  ['plastico_para_encapar', 'Plástico para encapar', { tags: ['plastico_encapar'] }],
  ['plastico_para_plastificar', 'Plástico para plastificar'],
  ['folhas_capas_plasticas', 'Folhas e capas plásticas'],
]);

const tecidosMantas = makeItems('tecido', 'simples', v, [
  ['tnt', 'TNT'],
  ['feltro', 'Feltro', { tags: ['feltro'] }],
]);

export const CATEGORY_PAPEIS_EVA_MATERIAIS = makeCategory(
  'papeis-eva-materiais',
  'Papéis, EVA e materiais',
  'Papéis para impressão, desenho e trabalhos, além de EVA, isopor, plásticos e tecidos.',
  3,
  true,
  [
    makeSubcategory('papeis', 'Papéis', 1, papeis),
    makeSubcategory('papeis-desenho', 'Papéis para desenho', 2, papeisDesenho),
    makeSubcategory('eva', 'EVA', 3, evaItems),
    makeSubcategory('isopor', 'Isopor', 4, isopor),
    makeSubcategory('plasticos-revestimentos', 'Plásticos e revestimentos', 5, plasticosRevestimentos),
    makeSubcategory('tecidos-mantas', 'Tecidos e mantas', 6, tecidosMantas),
  ],
);
