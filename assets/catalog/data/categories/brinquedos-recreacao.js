import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(11);

const brinquedos = makeItems('brinquedo', 'brinquedo', v, [
  ['brinquedo_ou_jogo', 'Brinquedo ou jogo', { desc: 'Conte o tipo, faixa etária e tema para ajudar a equipe a separar opções.' }],
], 'complementar');

export const CATEGORY_BRINQUEDOS_RECREACAO = makeCategory(
  'brinquedos-recreacao',
  'Brinquedos e recreação',
  'Brinquedos e jogos para todas as idades.',
  12,
  false,
  [
    makeSubcategory('brinquedos', 'Brinquedos e jogos', 1, brinquedos),
  ],
);
