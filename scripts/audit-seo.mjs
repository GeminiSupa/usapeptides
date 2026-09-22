import { writeFile } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:3108';
const output = process.argv[3];
const paths = ['/', '/shop', '/coa-database', '/bulk-discounts', '/calculator', '/about-us', '/faq', '/shipping-policy', '/privacy-policy', '/return-refund-policy', '/affiliates', '/product/bpc-157-5mg', '/category/extracellular-matrix-cell-migration-peptides'];
const clean = (s = '') => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/<!--.*?-->/g, '').trim();
const results = [];
for (const path of paths) {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1];
  const description = html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]*)"/)?.[1];
  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
    try { return JSON.parse(m[1]); } catch { return { error: 'Invalid JSON-LD' }; }
  });
  results.push({ path, status: response.status, finalUrl: response.url,
    title: clean(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]), canonical, description,
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => clean(m[1])),
    schemas: schemas.map((s) => s['@type'] || (s['@graph'] || []).map((g) => g['@type'])),
    canonicalPathMatches: Boolean(canonical && new URL(canonical).pathname === path),
  });
}
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
const report = { checkedAt: new Date().toISOString(), origin, results,
  sitemap: { status: sitemapResponse.status, urls: [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
    lastModified: [...new Set([...sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((m) => m[1]))] } };
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
