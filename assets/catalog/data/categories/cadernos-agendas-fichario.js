import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(0);

const cadernos = makeItems('caderno', 'cadernos', v, [
  ['caderno_universitario_1_materia', 'Caderno universitário 1 matéria', { syn: ['caderno_1_materia'] }],
  ['caderno_universitario_10_materias', 'Caderno universitário 10 matérias', { syn: ['caderno_10_materias'], desc: 'Para o ano letivo inteiro, com divisórias.' }],
  ['caderno_universitario_outras_materias', 'Caderno universitário (outras quantidades de matérias)', { desc: '2, 3, 4, 5 ou outras quantidades de matérias.' }],
  ['caderno_brochura', 'Caderno brochura'],
  ['caderno_brochurao', 'Caderno brochurão'],
  ['caderno_espiral_14', 'Caderno espiral 1/4'],
  ['caderno_colegial', 'Caderno colegial'],
  ['caderno_cartografia_desenho', 'Caderno de cartografia e desenho'],
  ['caderno_caligrafia', 'Caderno de caligrafia'],
  ['caderno_argolado', 'Caderno argolado'],
]);

const agendasPlanners = makeItems('agenda', 'simples', v, [
  ['agenda', 'Agenda', { desc: 'Para organização diária de compromissos.' }],
  ['planner', 'Planner', { tags: ['planner'] }],
  ['diario', 'Diário', { tags: ['diario'] }],
  ['calendario', 'Calendário', { tags: ['calendario'] }],
]);

const cadernetasBlocos = makeItems('bloco_adesivo', 'simples', v, [
  ['caderneta', 'Caderneta', { tags: ['caderneta'] }],
  ['bloco_anotacoes', 'Bloco de anotações'],
  ['bloco_adesivo_notas', 'Bloco adesivo e notas'],
]);

const fichariosRefis = makeItems('fichario', 'simples', v, [
  ['fichario', 'Fichário'],
  ['refil_fichario', 'Refil para fichário'],
  ['acessorios_fichario', 'Acessórios para fichário'],
]);

export const CATEGORY_CADERNOS_AGENDAS_FICHARIO = makeCategory(
  'cadernos-agendas-fichario',
  'Cadernos, agendas e fichários',
  'Cadernos para todas as matérias, agendas, planners e organização em fichário.',
  1,
  true,
  [
    makeSubcategory('cadernos', 'Cadernos', 1, cadernos),
    makeSubcategory('agendas-planners', 'Agendas e planners', 2, agendasPlanners),
    makeSubcategory('cadernetas-blocos-notas', 'Cadernetas, blocos e notas', 3, cadernetasBlocos),
    makeSubcategory('fichario-refis', 'Fichários e refis', 4, fichariosRefis),
  ],
);
