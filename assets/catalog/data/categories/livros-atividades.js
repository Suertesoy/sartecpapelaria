import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(8);

const livros = makeItems('livro', 'simples', v, [
  ['livro_para_colorir', 'Livro para colorir', { tags: ['livro_para_colorir'] }],
  ['livro_de_atividades', 'Livro de atividades', { tags: ['livro_atividades'] }],
  ['livro_educativo', 'Livro educativo'],
  ['literatura_infantil_juvenil', 'Literatura infantil e juvenil'],
  ['dicionario', 'Dicionário'],
  ['atlas', 'Atlas'],
  ['livro_de_apoio_escolar', 'Livro de apoio escolar'],
  ['revista_passatempo', 'Revista e passatempo'],
  ['gibi', 'Gibi'],
  ['album', 'Álbum'],
  ['livro_religioso', 'Livro religioso'],
], 'complementar');

const atividades = makeItems('atividade', 'simples', v, [
  ['folhas_de_atividades', 'Folhas de atividades'],
  ['folhas_para_colorir', 'Folhas para colorir'],
], 'complementar');

export const CATEGORY_LIVROS_ATIVIDADES = makeCategory(
  'livros-atividades',
  'Livros e atividades',
  'Livros de colorir, atividades, literatura e apoio escolar.',
  9,
  false,
  [
    makeSubcategory('livros', 'Livros', 1, livros),
    makeSubcategory('atividades', 'Atividades', 2, atividades),
  ],
);
