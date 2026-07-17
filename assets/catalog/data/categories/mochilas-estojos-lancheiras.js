import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(7);

const mochilas = makeItems('mochila', 'mochilas', v, [
  ['mochila_escolar', 'Mochila escolar', { tags: ['mochila_escolar'], syn: ['mochila_de_rodinhas', 'mochila_costas'] }],
]);

const estojos = makeItems('estojo', 'mochilas', v, [
  ['estojo_escolar', 'Estojo escolar', { tags: ['estojo_escolar'], syn: ['estojo_de_lapis'] }],
  ['estojo_duplo', 'Estojo duplo'],
  ['estojo_triplo', 'Estojo triplo'],
]);

const lancheiras = makeItems('lancheira', 'mochilas', v, [
  ['lancheira', 'Lancheira', { tags: ['lancheira'] }],
]);

const garrafas = makeItems('garrafa', 'simples', v, [
  ['garrafa', 'Garrafa', { tags: ['garrafa'] }],
  ['squeeze', 'Squeeze'],
]);

const bolsasMaletas = makeItems('bolsa', 'mochilas', v, [
  ['maleta', 'Maleta'],
  ['bolsa', 'Bolsa'],
  ['mala', 'Mala'],
]);

export const CATEGORY_MOCHILAS_ESTOJOS_LANCHEIRAS = makeCategory(
  'mochilas-estojos-lancheiras',
  'Mochilas, estojos e lancheiras',
  'Mochilas, estojos, lancheiras, garrafas e bolsas para escola e dia a dia.',
  8,
  true,
  [
    makeSubcategory('mochilas', 'Mochilas', 1, mochilas),
    makeSubcategory('estojos', 'Estojos', 2, estojos),
    makeSubcategory('lancheiras', 'Lancheiras', 3, lancheiras),
    makeSubcategory('garrafas', 'Garrafas', 4, garrafas),
    makeSubcategory('bolsas-maletas', 'Bolsas e maletas', 5, bolsasMaletas),
  ],
);
