import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(12);

const doces = makeItems('doce', 'simples', v, [
  ['bala', 'Bala'],
  ['bombom', 'Bombom'],
  ['doce', 'Doce'],
  ['pacote_de_doces', 'Pacote de doces'],
], 'complementar');

export const CATEGORY_DOCES_CONVENIENCIA = makeCategory(
  'doces-conveniencia',
  'Doces e conveniência',
  'Balas, bombons e doces em geral.',
  13,
  false,
  [
    makeSubcategory('doces', 'Doces', 1, doces),
  ],
);
