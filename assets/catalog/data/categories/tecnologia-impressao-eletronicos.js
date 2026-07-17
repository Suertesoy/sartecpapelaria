import { makeItems, makeSubcategory, makeCategory, createVariantCycler } from '../itemFactory.js';

const v = createVariantCycler(10);
const P = 'complementar';

const informatica = makeItems('informatica', 'tecnologia', v, [
  ['mouse_com_fio', 'Mouse com fio'],
  ['mouse_sem_fio', 'Mouse sem fio', { tags: ['mouse_sem_fio'] }],
  ['teclado', 'Teclado'],
  ['cabo_acessorio_eletronico', 'Cabo e acessório eletrônico'],
], P);

const armazenamento = makeItems('armazenamento', 'tecnologia', v, [
  ['pen_drive', 'Pen drive', { syn: ['pendrive', 'pen_drive_usb'] }],
], P);

const energia = makeItems('energia', 'simples', v, [
  ['pilha_aa', 'Pilha AA'],
  ['pilha_aaa', 'Pilha AAA'],
  ['bateria', 'Bateria'],
], P);

const impressao = makeItems('impressao', 'tecnologia', v, [
  ['cartucho', 'Cartucho de tinta', { tags: ['cartucho'], syn: ['cartucho_impressora'], desc: 'Informe o modelo da impressora para encontrarmos a opção adequada.' }],
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
