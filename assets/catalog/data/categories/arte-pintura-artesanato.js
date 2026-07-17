import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(4);

const tintas = makeItems('tinta', 'tintas', v, [
  ['tinta_guache', 'Tinta guache', { tags: ['tinta_guache'] }],
  ['tinta_para_tecido', 'Tinta para tecido', { tags: ['tinta_tecido'] }],
  ['tinta_acrilica', 'Tinta acrílica', { tags: ['tinta_acrilica'] }],
  ['tinta_pva_artesanato', 'Tinta PVA para artesanato'],
  ['tinta_dimensional_relevo', 'Tinta dimensional e relevo'],
  ['aquarela', 'Aquarela', { tags: ['aquarela'] }],
  ['tinta_spray', 'Tinta spray'],
  ['tinta_metalica', 'Tinta metálica'],
  ['tinta_nanquim', 'Tinta nanquim'],
  ['corante_anilina_pigmento', 'Corante, anilina ou pigmento'],
]);

const pinceisAcessorios = makeItems('pincel', 'simples', v, [
  ['pincel_chato', 'Pincel chato'],
  ['pincel_redondo', 'Pincel redondo'],
  ['pincel_artistico', 'Pincel artístico', { tags: ['pincel_artistico'], syn: ['pincel_para_pintura'] }],
  ['acessorios_para_pintura', 'Acessórios para pintura', { tags: ['acessorios_pintura'] }],
]);

const desenhoArtistico = makeItems('desenho_artistico', 'simples', v, [
  ['lapis_artistico', 'Lápis artístico'],
  ['materiais_desenho_artistico', 'Materiais para desenho artístico'],
  ['stencil', 'Stencil', { tags: ['stencil'] }],
]);

const modelagem = makeItems('modelagem', 'simples', v, [
  ['massa_de_modelar', 'Massa de modelar', { tags: ['massa_modelar'], syn: ['massinha', 'massinha_de_modelar'] }],
  ['kit_de_modelagem', 'Kit de modelagem', { tags: ['kit_modelagem'] }],
]);

const telasSuperficies = makeItems('tela', 'simples', v, [
  ['tela_para_pintura', 'Tela para pintura', { tags: ['tela_pintura'] }],
  ['cavalete', 'Cavalete', { tags: ['cavalete'] }],
]);

const preparacaoAcabamento = makeItems('acabamento_artistico', 'simples', v, [
  ['verniz', 'Verniz', { tags: ['verniz'] }],
  ['solvente_acabamento_artistico', 'Solvente e acabamento artístico'],
]);

const materiaisMontagem = makeItems('artesanato', 'simples', v, [
  ['palitos_e_hastes', 'Palitos e hastes', { tags: ['palitos_hastes'] }],
  ['areia_decorativa', 'Areia decorativa'],
  ['barbante_linha_cordao', 'Barbante, linha e cordão'],
  ['glitter', 'Glitter', { tags: ['glitter'] }],
  ['lantejoula', 'Lantejoula'],
  ['enfeites_para_artesanato', 'Enfeites para artesanato', { tags: ['enfeites_artesanato'] }],
  ['aviamentos_acessorios', 'Aviamentos e acessórios'],
]);

const kitsCriativos = makeItems('kit_criativo', 'simples', v, [
  ['maleta_de_pintura', 'Maleta de pintura'],
  ['maleta_para_colorir', 'Maleta para colorir'],
  ['kit_criativo', 'Kit criativo'],
]);

const protecao = makeItems('protecao', 'simples', v, [
  ['avental_escolar_artistico', 'Avental escolar e artístico', { tags: ['avental'] }],
]);

export const CATEGORY_ARTE_PINTURA_ARTESANATO = makeCategory(
  'arte-pintura-artesanato',
  'Arte, pintura e artesanato',
  'Tintas, pincéis, modelagem, telas e tudo para projetos criativos e artesanato.',
  5,
  true,
  [
    makeSubcategory('tintas', 'Tintas', 1, tintas),
    makeSubcategory('pinceis-acessorios', 'Pincéis e acessórios', 2, pinceisAcessorios),
    makeSubcategory('desenho-artistico', 'Desenho artístico', 3, desenhoArtistico),
    makeSubcategory('modelagem', 'Modelagem', 4, modelagem),
    makeSubcategory('telas-superficies', 'Telas e superfícies', 5, telasSuperficies),
    makeSubcategory('preparacao-acabamento', 'Preparação e acabamento', 6, preparacaoAcabamento),
    makeSubcategory('materiais-montagem', 'Materiais para montagem', 7, materiaisMontagem),
    makeSubcategory('kits-criativos', 'Kits criativos', 8, kitsCriativos),
    makeSubcategory('protecao', 'Proteção', 9, protecao),
  ],
);
