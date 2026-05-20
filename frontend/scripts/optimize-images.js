/**
 * PrimeClean image optimizer
 * Converts JPG/PNG to WebP + AVIF, generates responsive sizes.
 * Run: node scripts/optimize-images.js
 */
import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';

const SRC_DIR  = './motion/image';
const OUT_DIR  = './motion/image/optimized';
const EXTS     = ['.jpg', '.jpeg', '.png'];
const WEBP_Q   = 82;
const AVIF_Q   = 72;
const JPEG_Q   = 82;

// Responsive widths for service/chapter images
const RESPONSIVE_WIDTHS = [400, 800, 1200];

async function optimizeImage(srcPath) {
  const name = basename(srcPath, extname(srcPath));
  const ext  = extname(srcPath).toLowerCase();

  const img = sharp(srcPath);
  const meta = await img.metadata();
  const w = meta.width || 1200;

  console.log(`  ${name}${ext} (${w}px)`);

  // WebP (primary modern format)
  await sharp(srcPath)
    .webp({ quality: WEBP_Q, effort: 6 })
    .toFile(join(OUT_DIR, `${name}.webp`));
  console.log(`    → ${name}.webp`);

  // AVIF (best compression, newer browsers)
  await sharp(srcPath)
    .avif({ quality: AVIF_Q, effort: 6 })
    .toFile(join(OUT_DIR, `${name}.avif`))
    .catch(() => console.log(`    → ${name}.avif (skipped — encoder not available)`));

  // Optimised JPEG fallback
  if (ext !== '.png') {
    await sharp(srcPath)
      .jpeg({ quality: JPEG_Q, progressive: true, mozjpeg: true })
      .toFile(join(OUT_DIR, `${name}.jpg`));
    console.log(`    → ${name}.jpg`);
  }

  // Responsive WebP sizes (only for images wider than target)
  for (const targetW of RESPONSIVE_WIDTHS) {
    if (w > targetW) {
      await sharp(srcPath)
        .resize(targetW)
        .webp({ quality: WEBP_Q })
        .toFile(join(OUT_DIR, `${name}-${targetW}.webp`));
      console.log(`    → ${name}-${targetW}.webp`);
    }
  }
}

async function run() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const files = await readdir(SRC_DIR);
  const images = files.filter(f => EXTS.includes(extname(f).toLowerCase()));

  console.log(`\nOptimizing ${images.length} images from ${SRC_DIR}...\n`);

  for (const file of images) {
    await optimizeImage(join(SRC_DIR, file));
  }

  console.log('\nDone! Optimized images saved to:', OUT_DIR);
}

run().catch(err => { console.error(err); process.exit(1); });
