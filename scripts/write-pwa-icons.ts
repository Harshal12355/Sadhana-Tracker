import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, renderIconPixels } from '../src/pwa/iconArt';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

const files: Array<[string, number]> = [
  ['apple-touch-icon.png', 180],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
];

for (const [name, size] of files) {
  writeFileSync(join(publicDir, name), encodePng(size, size, renderIconPixels(size)));
}
