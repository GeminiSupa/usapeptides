// Run against `npm run start` after a production build.
import assert from 'node:assert/strict';
import sharp from 'sharp';

const origin = process.argv[2] || 'http://localhost:3000';
const page = await fetch(`${origin}/install`);
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /rel="manifest"[^>]*href="\/manifest.webmanifest"/);
assert.match(html, /apple-touch-icon/);
assert.match(html, /Android \/ Chrome/);
assert.match(html, /iPhone \/ Safari/);

const manifestResponse = await fetch(`${origin}/manifest.webmanifest`);
assert.equal(manifestResponse.status, 200);
assert.match(manifestResponse.headers.get('content-type'), /manifest\+json/);
const manifest = await manifestResponse.json();
assert.equal(manifest.id, '/');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.name);
for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
  const response = await fetch(`${origin}${icon.src}`);
  assert.equal(response.status, 200);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
}
const worker = await fetch(`${origin}/sw.js`);
assert.equal(worker.status, 200);
assert.match(worker.headers.get('cache-control'), /no-store/);
assert.match(worker.headers.get('content-type'), /javascript/);
assert.equal(worker.headers.get('service-worker-allowed'), '/');
const offline = await fetch(`${origin}/offline.html`);
assert.equal(offline.status, 200);
assert.match(await offline.text(), /You are offline/);
console.log('PASS: installation page, manifest linkage/identity, all four PNG dimensions, worker headers and offline document.');
