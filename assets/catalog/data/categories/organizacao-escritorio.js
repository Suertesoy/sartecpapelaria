import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(6);

const pastasArquivos = makeItems('pasta', 'organizacao', v, [
  ['pasta_com_elastico', 'Pasta com elástico', { tags: ['pasta_elastico'] }],
  ['pasta_l', 'Pasta L', { tags: ['pasta_l'] }],
  ['pasta_catalogo', 'Pasta catálogo', { tags: ['pasta_catalogo'] }],
  ['pasta_az', 'Pasta AZ', { syn: ['pasta_arquivo'] }],
  ['pasta_suspensa', 'Pasta suspensa'],
  ['pasta_organizadora', 'Pasta organizadora'],
  ['caixa_arquivo', 'Caixa arquivo', { tags: ['caixa_arquivo'], syn: ['pasta_arquivo_morto'] }],
  ['caixa_organizadora', 'Caixa organizadora'],
]);

const grampos = makeItems('grampo', 'organizacao', v, [
  ['grampeador', 'Grampeador', { tags: ['grampeador'], syn: ['grampeador_de_mesa'] }],
  ['grampo', 'Grampo', { tags: ['grampo'], syn: ['grampo_de_grampeador'] }],
  ['clips', 'Clips', { tags: ['clips'], syn: ['clipe', 'clipes'] }],
  ['prendedor_fixador', 'Prendedor e fixador'],
  ['perfurador', 'Perfurador', { syn: ['furador'] }],
]);

const encadernacao = makeItems('encadernacao', 'organizacao', v, [
  ['espiral_para_encadernacao', 'Espiral para encadernação'],
  ['capa_para_encadernacao', 'Capa para encadernação'],
]);

const envelopesCorrespondencia = makeItems('envelope', 'organizacao', v, [
  ['envelope_comum', 'Envelope comum', { tags: ['envelope'] }],
  ['envelope_kraft', 'Envelope kraft', { tags: ['envelope'] }],
  ['envelope_saco', 'Envelope saco', { tags: ['envelope'] }],
  ['malote', 'Malote'],
  ['porta_documentos', 'Porta documentos'],
  ['protetor_de_documentos', 'Protetor de documentos'],
]);

const acessoriosMesa = makeItems('mesa', 'organizacao', v, [
  ['prancheta', 'Prancheta'],
  ['organizador_de_mesa', 'Organizador de mesa'],
  ['porta_objetos', 'Porta objetos'],
  ['molha_dedos', 'Molha dedos'],
  ['suporte_celular_tablet', 'Suporte para celular ou tablet'],
]);

const calculadoras = makeItems('calculadora', 'simples', v, [
  ['calculadora', 'Calculadora'],
]);

const carimbos = makeItems('carimbo', 'simples', v, [
  ['carimbo', 'Carimbo'],
  ['almofada_para_carimbo', 'Almofada para carimbo'],
  ['tinta_para_carimbo', 'Tinta para carimbo'],
  ['numerador', 'Numerador'],
]);

const bobinas = makeItems('bobina', 'organizacao', v, [
  ['bobina_termica_pdv', 'Bobina térmica e PDV'],
  ['bobina_de_papel', 'Bobina de papel'],
]);

const etiquetagem = makeItems('etiquetadora', 'simples', v, [
  ['etiquetadora', 'Etiquetadora'],
  ['etiquetadora_de_preco', 'Etiquetadora de preço'],
  ['refil_para_etiquetadora', 'Refil para etiquetadora'],
]);

const formulariosImpressos = makeItems('formulario', 'simples', v, [
  ['formulario_comercial', 'Formulário comercial'],
  ['livro_comercial_registro', 'Livro comercial e de registro'],
  ['bloco_comercial', 'Bloco comercial'],
  ['ficha_cadastro_controle', 'Ficha para cadastro e controle'],
]);

const quadrosApresentacao = makeItems('quadro', 'organizacao', v, [
  ['quadro_branco', 'Quadro branco', { tags: ['quadro_branco'] }],
  ['quadro_de_cortica', 'Quadro de cortiça'],
  ['lousa', 'Lousa'],
  ['apagador_para_quadro', 'Apagador para quadro', { tags: ['apagador_quadro'] }],
  ['ima', 'Ímã', { tags: ['ima'] }],
  ['painel_para_apresentacao', 'Painel para apresentação'],
]);

const sinalizacaoIdentificacao = makeItems('sinalizacao', 'simples', v, [
  ['placa_de_sinalizacao', 'Placa de sinalização'],
  ['cracha_identificacao', 'Crachá e identificação'],
  ['cartaz_painel', 'Cartaz e painel'],
]);

export const CATEGORY_ORGANIZACAO_ESCRITORIO = makeCategory(
  'organizacao-escritorio',
  'Organização e escritório',
  'Pastas, arquivos, grampeadores, envelopes, quadros e itens para o dia a dia do escritório.',
  7,
  true,
  [
    makeSubcategory('pastas-arquivos', 'Pastas e arquivos', 1, pastasArquivos),
    makeSubcategory('grampos-fixacao', 'Grampos e fixação', 2, grampos),
    makeSubcategory('encadernacao', 'Encadernação', 3, encadernacao),
    makeSubcategory('envelopes-correspondencia', 'Envelopes e correspondência', 4, envelopesCorrespondencia),
    makeSubcategory('acessorios-mesa', 'Acessórios de mesa', 5, acessoriosMesa),
    makeSubcategory('calculadoras', 'Calculadoras', 6, calculadoras),
    makeSubcategory('carimbos', 'Carimbos', 7, carimbos),
    makeSubcategory('bobinas', 'Bobinas', 8, bobinas),
    makeSubcategory('etiquetagem', 'Etiquetagem', 9, etiquetagem),
    makeSubcategory('formularios-impressos', 'Formulários e impressos', 10, formulariosImpressos),
    makeSubcategory('quadros-apresentacao', 'Quadros e apresentação', 11, quadrosApresentacao),
    makeSubcategory('sinalizacao-identificacao', 'Sinalização e identificação', 12, sinalizacaoIdentificacao),
  ],
);
