#!/usr/bin/env node
/* ======================================================
   Gera variantes WebP menores dos PNGs de catálogo para uso
   no frontend (camada derivada, não substitui os PNGs fonte).
   Uso: node assets/catalog/generate-webp.mjs
   Requer devDependency "sharp" (não usada em runtime/produção).
   ====================================================== */

import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, 'images');
const WEBP_DIR = path.join(IMAGES_DIR, 'webp');

// Maior caixa de exibição do produto no site é o card (até ~300px, 72% de
// preenchimento) em telas retina (2x) — 640px cobre com folga sem carregar
// os 2048px originais desnecessariamente.
const TARGET_SIZE = 640;
const QUALITY = 82;

mkdirSync(WEBP_DIR, { recursive: true });

const pngFiles = readdirSync(IMAGES_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

let generated = 0;
let skipped = 0;
let totalPngBytes = 0;
let totalWebpBytes = 0;

for (const file of pngFiles) {
  const srcPath = path.join(IMAGES_DIR, file);
  const destPath = path.join(WEBP_DIR, file.replace(/\.png$/i, '.webp'));
  const srcStat = statSync(srcPath);
  totalPngBytes += srcStat.size;

  await sharp(srcPath)
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(destPath);

  totalWebpBytes += statSync(destPath).size;
  generated++;
}

console.log(`Geradas ${generated} imagens WebP em ${path.relative(process.cwd(), WEBP_DIR)}`);
console.log(`Tamanho total PNG (fonte): ${(totalPngBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`Tamanho total WebP (derivado): ${(totalWebpBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`Redução: ${(100 - (totalWebpBytes / totalPngBytes) * 100).toFixed(1)}%`);
