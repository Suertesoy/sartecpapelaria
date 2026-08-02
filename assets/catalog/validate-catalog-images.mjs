#!/usr/bin/env node
/* ======================================================
   Validação programática: produtos ativos × manifest.json × disco.
   Uso: node assets/catalog/validate-catalog-images.mjs
   ====================================================== */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'images');

const { CATALOG_CATEGORIES } = await import('./data/catalog-data.js');
const manifest = JSON.parse(readFileSync(path.join(IMAGES_DIR, 'manifest.json'), 'utf8'));

const activeItems = [];
for (const category of CATALOG_CATEGORIES) {
  for (const sub of category.subcategories) {
    for (const item of sub.items) {
      if (item.active) activeItems.push({ item, category, subcategory: sub });
    }
  }
}

const manifestIds = new Set(manifest.imagens.map((m) => m.id));
const diskFiles = new Set(readdirSync(IMAGES_DIR).filter((f) => f.toLowerCase().endsWith('.png')));
const webpFiles = new Set(readdirSync(path.join(IMAGES_DIR, 'webp')).filter((f) => f.toLowerCase().endsWith('.webp')));

const semImagemNoManifest = [];
const referenciasQuebradas = [];
const webpFaltando = [];
const duplicadas = [];
const seenIds = new Map();
let comArquivoEmDisco = 0;

for (const { item } of activeItems) {
  const count = (seenIds.get(item.id) || 0) + 1;
  seenIds.set(item.id, count);
  if (count > 1) duplicadas.push(item.id);

  if (!manifestIds.has(item.id)) {
    semImagemNoManifest.push(item.id);
    continue;
  }
  const expectedFile = `${item.id}.png`;
  if (diskFiles.has(expectedFile)) {
    comArquivoEmDisco++;
  } else {
    referenciasQuebradas.push(item.id);
  }
  if (!webpFiles.has(`${item.id}.webp`)) {
    webpFaltando.push(item.id);
  }
}

const activeIdSet = new Set(activeItems.map((a) => a.item.id));
const manifestSemProdutoAtivo = [...manifestIds].filter((id) => !activeIdSet.has(id));
const arquivosOrfaos = [...diskFiles].filter((f) => !activeIdSet.has(f.replace(/\.png$/i, '')));

console.log('=== Auditoria do catálogo: produtos × manifest × disco ===');
console.log(`Produtos ativos: ${activeItems.length}`);
console.log(`Produtos com referência no manifest: ${activeItems.length - semImagemNoManifest.length}`);
console.log(`Arquivos encontrados no disco (para produtos ativos): ${comArquivoEmDisco}`);
console.log(`Produtos sem imagem (sem entrada no manifest): ${semImagemNoManifest.length}`);
console.log(`Referências quebradas (no manifest mas arquivo ausente no disco): ${referenciasQuebradas.length}`);
console.log(`Imagens em disco não usadas por nenhum produto ativo: ${arquivosOrfaos.length}`);
console.log(`Entradas do manifest sem produto ativo correspondente: ${manifestSemProdutoAtivo.length}`);
console.log(`Referências de id duplicadas entre produtos ativos: ${duplicadas.length}`);
console.log(`Variantes WebP derivadas faltando (rodar generate-webp.mjs): ${webpFaltando.length}`);

if (semImagemNoManifest.length) console.log('\nProdutos sem imagem:', semImagemNoManifest);
if (referenciasQuebradas.length) console.log('\nReferências quebradas:', referenciasQuebradas);
if (arquivosOrfaos.length) console.log('\nImagens órfãs:', arquivosOrfaos);
if (manifestSemProdutoAtivo.length) console.log('\nManifest sem produto ativo:', manifestSemProdutoAtivo);
if (duplicadas.length) console.log('\nIds duplicados:', duplicadas);
if (webpFaltando.length) console.log('\nWebP faltando:', webpFaltando);

const ok =
  semImagemNoManifest.length === 0 &&
  referenciasQuebradas.length === 0 &&
  arquivosOrfaos.length === 0 &&
  duplicadas.length === 0 &&
  webpFaltando.length === 0;

console.log(`\nResultado: ${ok ? 'OK — catálogo 100% consistente' : 'FALHOU — ver detalhes acima'}`);
process.exit(ok ? 0 : 1);
