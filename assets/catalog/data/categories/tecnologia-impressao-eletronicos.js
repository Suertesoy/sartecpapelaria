import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(10);
const P = 'complementar';

const informatica = makeItems('informatica', 'tecnologia', v, [
  ['mouse', 'Mouse'],
  ['teclado', 'Teclado'],
  ['cabo_acessorio_eletronico', 'Cabo e acessório eletrônico'],
], P);

const armazenamento = makeItems('armazenamento', 'tecnologia', v, [
  ['pen_drive', 'Pen drive', { syn: ['pendrive', 'pen_drive_usb'] }],
], P);

const energia = makeItems('energia', 'simples', v, [
  ['pilha', 'Pilha'],
  ['bateria', 'Bateria'],
], P);

const impressao = makeItems('impressao', 'tecnologia', v, [
  ['cartucho', 'Cartucho', { tags: ['cartucho'], syn: ['cartucho_impressora'] }],
  ['toner', 'Toner', { tags: ['toner'], syn: ['toner_impressora'] }],
  ['tinta_para_impressora', 'Tinta para impressora'],
  ['refil_tinta_impressora', 'Refil de tinta para impressora', { syn: ['refil_de_tinta'] }],
], P);

const midias = makeItems('midia', 'simples', v, [
  ['cd', 'CD'],
  ['dvd', 'DVD'],
], P);

const equipamentos = makeItems('equipamento', 'tecnologia', v, [
  ['fragmentadora_de_papel', 'Fragmentadora de papel'],
  ['caixa_de_som', 'Caixa de som', { syn: ['cx_som'] }],
], P);

export const CATEGORY_TECNOLOGIA_IMPRESSAO_ELETRONICOS = makeCategory(
  'tecnologia-impressao-eletronicos',
  'Tecnologia, impressão e eletrônicos',
  'Informática, armazenamento, suprimentos de impressão e pequenos eletrônicos.',
  11,
  false,
  [
    makeSubcategory('informatica', 'Informática', 1, informatica),
    makeSubcategory('armazenamento', 'Armazenamento', 2, armazenamento),
    makeSubcategory('energia', 'Energia', 3, energia),
    makeSubcategory('impressao', 'Impressão', 4, impressao),
    makeSubcategory('midias', 'Mídias', 5, midias),
    makeSubcategory('equipamentos', 'Equipamentos', 6, equipamentos),
  ],
);
