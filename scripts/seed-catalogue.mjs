/**
 * Seed the Supabase `products` table from the local catalogue.
 *
 *   node scripts/seed-catalogue.mjs
 *
 * Idempotent: upserts on `slug`, so running it twice updates rather than
 * duplicates. Reads credentials from .env.local.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Minimal .env.local loader - avoids adding dotenv as a dependency.
async function loadEnv() {
  try {
    const raw = await readFile(path.resolve('.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No .env.local - fall back to whatever is already in the environment.
  }
}

await loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error(
    '\nMissing credentials.\n' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.\n'
  );
  process.exit(1);
}

// The catalogue is TypeScript. Strip the type annotations and import the data
// as a plain ES module rather than pulling in a transpiler.
const source = await readFile(path.resolve('src/data/products.ts'), 'utf8');
const body = source
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/export const products:\s*Product\[\]\s*=/, 'const products =')
  .concat('\nexport { products };');

const moduleUrl =
  'data:text/javascript;base64,' + Buffer.from(body, 'utf8').toString('base64');
const { products } = await import(moduleUrl);

console.log(`Loaded ${products.length} products from src/data/products.ts`);

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rows = products.map((p) => ({
  slug: p.slug,
  name: p.name,
  category: p.category,
  category_slug: p.categorySlug,
  price: p.price,
  sale_price: p.salePrice ?? null,
  sku: p.sku,
  purity: p.purity,
  sequence: p.sequence ?? null,
  cas_number: p.casNumber ?? null,
  molar_mass: p.molarMass ?? null,
  formula: p.formula ?? null,
  storage: p.storage,
  appearance: p.appearance,
  description: p.description,
  details: p.details ?? [],
  specs: p.specs ?? [],
  bulk_pricing: p.bulkPricing ?? [],
  coa: p.coa ?? null,
  image: p.image,
  tags: p.tags ?? [],
  in_stock: p.inStock ?? true,
  stock_count: p.stockCount ?? 0,
  is_featured: Boolean(p.isFeatured),
  is_popular: Boolean(p.isPopular),
  is_active: true,
}));

const { data, error } = await db
  .from('products')
  .upsert(rows, { onConflict: 'slug' })
  .select('slug');

if (error) {
  console.error('\nSeed failed:', error.message);
  process.exit(1);
}

console.log(`Upserted ${data.length} products into Supabase.`);
