import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(5);

const apontadores = makeItems('apontador', 'simples', v, [
  ['apontador', 'Apontador', { tags: ['apontador'] }],
]);

const corte = makeItems('corte', 'simples', v, [
  ['tesoura', 'Tesoura', { tags: ['tesoura'] }],
  ['estilete', 'Estilete', { tags: ['estilete'] }],
  ['lamina_para_estilete', 'Lâmina para estilete'],
  ['guilhotina', 'Guilhotina'],
]);

const medicaoGeometria = makeItems('geometria', 'simples', v, [
  ['regua', 'Régua', { tags: ['regua'], syn: ['regua_30cm'] }],
  ['esquadro', 'Esquadro', { tags: ['esquadro'] }],
  ['transferidor', 'Transferidor'],
  ['compasso', 'Compasso', { tags: ['compasso'] }],
  ['escalimetro', 'Escalímetro'],
  ['gabarito', 'Gabarito'],
  ['lupa', 'Lupa'],
  ['kit_de_geometria', 'Kit de geometria'],
]);

const acessoriosEscrita = makeItems('acessorio_escrita', 'simples', v, [
  ['grip_para_lapis_caneta', 'Grip para lápis e caneta'],
]);

const materiaisEducativos = makeItems('educativo', 'simples', v, [
  ['abaco', 'Ábaco'],
  ['tabuada', 'Tabuada'],
  ['globo_terrestre', 'Globo terrestre'],
  ['kit_educativo', 'Kit educativo'],
]);

const kitsEscolares = makeItems('kit_escolar', 'simples', v, [
  ['kit_escolar', 'Kit escolar'],
]);

export const CATEGORY_ACESSORIOS_ESCOLARES_GEOMETRIA = makeCategory(
  'acessorios-escolares-geometria',
  'Acessórios escolares e geometria',
  'Apontadores, itens de corte, régua, compasso e outros acessórios para a rotina escolar.',
  6,
  true,
  [
    makeSubcategory('apontadores', 'Apontadores', 1, apontadores),
    makeSubcategory('corte', 'Corte', 2, corte),
    makeSubcategory('medicao-geometria', 'Medição e geometria', 3, medicaoGeometria),
    makeSubcategory('acessorios-escrita', 'Acessórios para escrita', 4, acessoriosEscrita),
    makeSubcategory('materiais-educativos', 'Materiais educativos', 5, materiaisEducativos),
    makeSubcategory('kits-escolares', 'Kits escolares', 6, kitsEscolares),
  ],
);
