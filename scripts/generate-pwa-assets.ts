/**
 * Gera assets para empacotamento Android (TWA) e iOS (Capacitor) a partir do logo master.
 *
 * Saídas:
 *   public/icons/apple-touch-icon-{120,152,167,180}.png — Apple touch icons
 *   public/icons/maskable-{192,512}.png                — PWA maskable com safe zone 80%
 *   public/icons/app-store-1024.png                    — App Store (sem alpha, fundo opaco)
 *   public/icons/splash-master.png                     — 2732×2732 pra Capacitor gerar splashes iOS
 *
 * Run: npx tsx scripts/generate-pwa-assets.ts
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC_ICON = join(ROOT, 'public', 'brand', 'logo-icon.png');
const OUT_DIR = join(ROOT, 'public', 'icons');
const THEME_COLOR = { r: 32, g: 54, b: 78 };

mkdirSync(OUT_DIR, { recursive: true });

async function appleTouchIcon(size: number) {
  const out = join(OUT_DIR, `apple-touch-icon-${size}.png`);
  await sharp(SRC_ICON).resize(size, size, { fit: 'contain' }).png().toFile(out);
  console.log(`✓ ${out}`);
}

async function maskableIcon(size: number) {
  // Safe zone 80% (Android masks recortam até ~10% de cada borda)
  const inner = Math.round(size * 0.8);
  const out = join(OUT_DIR, `maskable-${size}.png`);
  const innerBuf = await sharp(SRC_ICON).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: THEME_COLOR },
  })
    .composite([{ input: innerBuf, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}

async function appStoreIcon() {
  const out = join(OUT_DIR, 'app-store-1024.png');
  // Apple exige 1024×1024 PNG sem canal alpha. Background opaco no theme color.
  const inner = await sharp(SRC_ICON).resize(900, 900, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: THEME_COLOR },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}

async function splashMaster() {
  const out = join(OUT_DIR, 'splash-master.png');
  // 2732×2732 — Capacitor split em todos os tamanhos iOS automaticamente.
  const inner = await sharp(SRC_ICON).resize(800, 800, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: 2732, height: 2732, channels: 3, background: THEME_COLOR },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}

async function main() {
  console.log(`Gerando assets a partir de ${SRC_ICON}\n`);
  for (const size of [120, 152, 167, 180]) await appleTouchIcon(size);
  for (const size of [192, 512]) await maskableIcon(size);
  await appStoreIcon();
  await splashMaster();
  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
