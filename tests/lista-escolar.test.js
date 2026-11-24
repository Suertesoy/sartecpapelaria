import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { normalizarItens, recortarPagina } from '../api/analisar-lista.js';

test('preserva quantidades explícitas, inclusive acima de 99', () => {
  const itens = normalizarItens([
    { nome: 'Folhas de sulfite A4', qty: 500, unidade: 'folha' },
    { nome: 'Folhas de sulfitão branco', qty: 5, unidade: 'folha' },
    { nome: 'Copos descartáveis', qty: '200', unidade: 'un' },
    { nome: 'Folhas de papel colorido', qty: 100, unidade: 'folha' },
  ]);
  assert.deepEqual(itens.map(({ nome, qty, unidade }) => [nome, qty, unidade]), [
    ['Folhas de sulfite A4', 500, 'folha'],
    ['Folhas de sulfitão branco', 5, 'folha'],
    ['Copos descartáveis', 200, 'un'],
    ['Folhas de papel colorido', 100, 'folha'],
  ]);
});

test('mantém o conteúdo da embalagem separado da quantidade pedida', () => {
  const [resma, canetinhas, estojo] = normalizarItens([
    { nome: 'Resma de sulfite A4', qty: 1, unidade: 'resma', conteudoEmbalagem: ' 500 folhas ', obs: '75 g/m²' },
    { nome: 'Estojo de canetinhas', qty: 1, unidade: 'caixa', conteudoEmbalagem: '12 unidades' },
    { nome: 'Estojo escolar', qty: 1, recipienteSeparado: true, conteudoEmbalagem: '2 lápis e 1 régua', obs: 'com zíper' },
  ]);
  assert.equal(resma.qty, 1);
  assert.equal(resma.conteudoEmbalagem, '500 folhas');
  assert.equal(resma.obs, '75 g/m²');
  assert.equal(canetinhas.qty, 1);
  assert.equal(canetinhas.conteudoEmbalagem, '12 unidades');
  assert.equal(estojo.conteudoEmbalagem, '');
  assert.equal(estojo.obs, 'com zíper');
});

test('sinaliza quantidades inválidas em vez de trocar por 1', () => {
  for (const qty of [null, undefined, '', 'ilegível', 0, -2, 1.5, true, Infinity]) {
    const [item] = normalizarItens([{ nome: 'Sacos plásticos A4 com furos', qty, confianca: 'alta' }]);
    assert.equal(item.qty, null);
    assert.equal(item.confianca, 'baixa');
  }
});

test('preserva o trecho da lista que precisa de conferência', () => {
  const [item] = normalizarItens([
    { nome: 'Papel cartão', qty: 8, confianca: 'alta', trechoDuvidoso: ' 2 amarelos, 2 verdes, 2 laranjas e 2 verdes ' },
  ]);
  assert.equal(item.qty, 8);
  assert.equal(item.confianca, 'baixa');
  assert.equal(item.trechoDuvidoso, '2 amarelos, 2 verdes, 2 laranjas e 2 verdes');
});

test('preserva variantes, itens repetidos em seções distintas e listas com mais de 80 linhas', () => {
  const itens = normalizarItens([
    { nome: 'Pincel nº 08', qty: 1, obs: 'cerdas macias' },
    { nome: 'Pincel nº 08', qty: 1, obs: 'cerdas duras, cabo amarelo' },
    { nome: 'Lápis preto', qty: 8, obs: 'material de entrega' },
    { nome: 'Lápis preto', qty: 2, obs: 'estojo' },
    ...Array.from({ length: 80 }, (_, i) => ({ nome: `Material ${i + 1}`, qty: 1 })),
  ]);
  assert.equal(itens.length, 84);
  assert.equal(new Set(itens.map(({ id }) => id)).size, 84);
  assert.deepEqual(itens.slice(0, 4).map(({ qty, obs }) => [qty, obs]), [
    [1, 'cerdas macias'],
    [1, 'cerdas duras, cabo amarelo'],
    [8, 'material de entrega'],
    [2, 'estojo'],
  ]);
});

test('recorta páginas grandes com sobreposição e mantém fotos pequenas na análise integral', async () => {
  const gerarImagem = (width, height) => sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  }).jpeg().toBuffer();

  assert.deepEqual(await recortarPagina(await gerarImagem(800, 1100)), []);

  const recortes = await recortarPagina(await gerarImagem(1200, 1600));
  assert.deepEqual(recortes.map(({ nome }) => nome), [
    'superior esquerdo', 'superior direito', 'inferior esquerdo', 'inferior direito',
  ]);
  for (const recorte of recortes) {
    const { width, height } = await sharp(recorte.imagem).metadata();
    assert.equal(width, 696);
    assert.equal(height, 928);
  }
});
