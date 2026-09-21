// Reuse the existing brand mark, preserving its proportions and opaque background.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
const source = fileURLToPath(new URL('../public/favicon.png', import.meta.url));
for (const [name, size] of [['app-192', 192], ['app-512', 512], ['apple-touch-icon', 180]]) {
  await sharp(source).resize(size, size)
    .png().toFile(fileURLToPath(new URL(`../public/icons/${name}.png`, import.meta.url)));
}
// The entire original mark fits inside the maskable icon's central safe zone.
const mark = await sharp(source).resize(360, 360).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#081c14' } })
  .composite([{ input: mark, gravity: 'centre' }]).png()
  .toFile(fileURLToPath(new URL('../public/icons/app-maskable-512.png', import.meta.url)));
