import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:3108';
const paths = ['/coa-database', '/bulk-discounts', '/calculator', '/shipping-policy', '/privacy-policy', '/return-refund-policy', '/affiliates'];
const titles = new Set();
for (const path of paths) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const canonical = html.match(/rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.ok(canonical, `Missing canonical: ${path}`);
  assert.equal(new URL(canonical).pathname, path);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title && !titles.has(title), `Missing/duplicate title: ${path}`);
  titles.add(title);
  const description = html.match(/name="description"[^>]*content="([^"]+)"/)?.[1];
  assert.ok(description, `Missing description: ${path}`);
  assert.equal(html.match(/name="twitter:description"[^>]*content="([^"]+)"/)?.[1], description);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `H1 count: ${path}`);
}

const productResponse = await fetch(`${origin}/product/bpc-157-5mg`);
assert.equal(productResponse.status, 200);
const productHtml = await productResponse.text();
const schemas = [...productHtml.matchAll(/type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const product = schemas.find((s) => s['@type'] === 'Product');
assert.ok(product);
assert.ok(productHtml.includes(product.name));
assert.ok(productHtml.includes(product.offers.price), 'Schema price must be in initial HTML');
assert.ok(productHtml.includes('Before placing a research order'));
const missing = await fetch(`${origin}/product/zz-seo-audit-missing-product`);
assert.equal(missing.status, 404, 'Unknown product must send an HTTP 404');

const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
const records = [...sitemap.matchAll(/<url>(.*?)<\/url>/gs)].map((m) => m[1]);
const urls = records.map((r) => r.match(/<loc>(.*?)<\/loc>/)?.[1]);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URLs');
for (const path of paths) assert.ok(urls.some((url) => new URL(url).pathname === path));
for (const record of records) {
  const path = new URL(record.match(/<loc>(.*?)<\/loc>/)[1]).pathname;
  if (paths.includes(path) || path === '/') assert.ok(!record.includes('<lastmod>'), `Invented static update: ${path}`);
}
console.log('PASS: seven distinct canonicals/titles/descriptions/social descriptions, H1s, product schema/content, unknown product 404, sitemap URLs and honest static dates.');
