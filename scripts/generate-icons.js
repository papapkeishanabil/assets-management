/**
 * Script untuk generate PWA icon files dari SVG.
 * Ikon ini bersifat temporer dan dapat diganti dengan ikon perusahaan yang sebenarnya.
 *
 * Ikon Harmas Asset Management:
 * - Background: gradient primary-500 (#3b82f6) ke indigo-600 (#4f46e5)
 * - Foreground: "H" putih besar + ikon kunci pas (wrench) kecil
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// SVG icon sumber (512x512)
const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="harmasGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#harmasGradient)"/>
  <text x="256" y="330" font-family="Arial, Helvetica, sans-serif" font-size="270" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="-4">H</text>
  <!-- Simple wrench icon -->
  <g transform="translate(370, 370) rotate(-20)">
    <rect x="-4" y="-28" width="8" height="56" rx="4" fill="white" opacity="0.9"/>
    <rect x="-28" y="-4" width="56" height="8" rx="4" fill="white" opacity="0.9"/>
    <rect x="-16" y="-16" width="32" height="32" rx="6" fill="white" opacity="0.3"/>
  </g>
</svg>`;

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Generate PNG icons
  const sizes = [192, 512];
  for (const size of sizes) {
    const outputPath = join(PUBLIC_DIR, `icon-${size}x${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}x${size}.png`);
  }

  // Generate maskable icons (same design, marked as maskable)
  for (const size of sizes) {
    const outputPath = join(PUBLIC_DIR, `icon-maskable-${size}x${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-maskable-${size}x${size}.png`);
  }

  // Generate apple touch icon (180x180)
  const applePath = join(PUBLIC_DIR, 'apple-touch-icon.png');
  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log('  Created: apple-touch-icon.png');

  // Generate favicon.ico (PNG format but with .ico extension - browser compatible)
  const faviconPath = join(PUBLIC_DIR, 'favicon.ico');
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .png()
    .toFile(faviconPath);
  console.log('  Created: favicon.ico (PNG)');

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
