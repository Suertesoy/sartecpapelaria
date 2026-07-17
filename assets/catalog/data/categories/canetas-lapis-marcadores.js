import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(1);

const canetas = makeItems('caneta', 'escrita', v, [
  ['caneta_esferografica', 'Caneta esferográfica', { tags: ['caneta_esferografica'], syn: ['bic', 'esferografica'] }],
  ['caneta_gel', 'Caneta gel', { tags: ['caneta_gel'] }],
  ['caneta_hidrografica', 'Caneta hidrográfica', { tags: ['caneta_hidrografica'], syn: ['canetinha', 'hidrocor'], desc: 'Ponta macia, ideal para colorir e desenhar.' }],
  ['caneta_tecnica_fineliner', 'Caneta técnica e fine liner', { tags: ['caneta_tecnica'] }],
  ['caneta_brush_lettering', 'Caneta brush e lettering', { tags: ['caneta_brush'] }],
  ['caneta_especial', 'Caneta especial'],
]);

const lapis = makeItems('lapis', 'escrita', v, [
  ['lapis_grafite', 'Lápis grafite', { tags: ['lapis_grafite'], syn: ['lapis_de_escrever', 'lapis_preto'] }],
  ['lapis_de_cor', 'Lápis de cor', { tags: ['lapis_de_cor'], desc: 'Em conjuntos com diferentes quantidades de cores.' }],
]);

const lapiseirasGrafites = makeItems('lapiseira', 'escrita', v, [
  ['lapiseira', 'Lapiseira', { tags: ['lapiseira'] }],
  ['grafite_lapiseira', 'Grafite para lapiseira', { tags: ['grafite_lapiseira'] }],
]);

const marcadores = makeItems('marcador', 'escrita', v, [
  ['marca_texto', 'Marca texto', { tags: ['marca_texto'] }],
  ['marcador_quadro_branco', 'Marcador para quadro branco', { tags: ['marcador_quadro_branco'], syn: ['caneta_para_quadro', 'caneta_quadro_branco'] }],
  ['marcador_permanente', 'Marcador permanente', { tags: ['marcador_permanente'], syn: ['pincel_atomico', 'caneta_permanente'] }],
  ['marcador_brush_lettering', 'Marcador brush e lettering'],
  ['marcador_especial', 'Marcador especial'],
  ['refil_marcador_quadro_branco', 'Refil para marcador de quadro branco', { tags: ['refil_marcador_quadro'] }],
  ['refil_marcador_permanente', 'Refil para marcador permanente'],
]);

const giz = makeItems('giz', 'simples', v, [
  ['giz_de_cera', 'Giz de cera'],
  ['giz_para_quadro', 'Giz para quadro', { syn: ['giz_de_lousa'] }],
]);

export const CATEGORY_CANETAS_LAPIS_MARCADORES = makeCategory(
  'canetas-lapis-marcadores',
  'Canetas, lápis e marcadores',
  'Escrita, desenho e ilustração: canetas, lápis, lapiseiras, marcadores e giz.',
  2,
  true,
  [
    makeSubcategory('canetas', 'Canetas', 1, canetas),
    makeSubcategory('lapis', 'Lápis', 2, lapis),
    makeSubcategory('lapiseiras-grafites', 'Lapiseiras e grafites', 3, lapiseirasGrafites),
    makeSubcategory('marcadores', 'Marcadores', 4, marcadores),
    makeSubcategory('giz', 'Giz', 5, giz),
  ],
);
