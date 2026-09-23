'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mapDbProducts, fallbackProducts, type DbProduct } from '@/lib/catalogue';
import type { Product } from '@/types';

/**
 * The storefront catalogue, read live from the database the dashboard writes to.
 *
 * Fetched once per page load and shared between every component that asks for
 * it, so a page showing the shop grid, the search modal and the header does not
 * make three identical requests.
 *
 * If Supabase is unreachable, or the table is empty, the bundled catalogue in
 * `src/data/products.ts` is used instead. A visitor never sees an empty shop
 * because of a network blip.
 */

export type CatalogueSource = 'database' | 'bundled';

interface CatalogueResult {
  products: Product[];
  loading: boolean;
  source: CatalogueSource;
}

const SELECT =
  'id, slug, name, category, category_slug, price, sale_price, sku, purity, sequence,' +
  ' cas_number, molar_mass, formula, storage, appearance, description, details, specs,' +
  ' bulk_pricing, coa, coa_url, coa_lot, coa_tested_at, image, detail_image, tags, in_stock,' +
  ' stock_count, is_featured, is_popular, is_active';

let cache: Promise<{ products: Product[]; source: CatalogueSource }> | null = null;

async function fetchCatalogue(): Promise<{ products: Product[]; source: CatalogueSource }> {
  if (!supabase) return { products: fallbackProducts, source: 'bundled' };

  const { data, error } = await supabase
    .from('products')
    .select(SELECT)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data?.length) {
    if (error) console.warn('[catalogue] falling back to bundled data:', error.message);
    return { products: fallbackProducts, source: 'bundled' };
  }

  const mapped = mapDbProducts(data as unknown as DbProduct[]);
  const { data: memberships, error: membershipError } = await supabase
    .from('product_category_assignments')
    .select('product_id, product_categories(name,slug)');
  if (membershipError) return { products: mapped, source: 'database' };

  const byProduct = new Map<string, { names: string[]; slugs: string[] }>();
  for (const membership of memberships ?? []) {
    const category = (membership as any).product_categories;
    if (!category?.slug) continue;
    const entry = byProduct.get(membership.product_id) ?? { names: [], slugs: [] };
    if (!entry.slugs.includes(category.slug)) entry.slugs.push(category.slug);
    if (!entry.names.includes(category.name)) entry.names.push(category.name);
    byProduct.set(membership.product_id, entry);
  }
  return {
    products: mapped.map((product) => {
      const assigned = byProduct.get(product.id);
      return assigned ? { ...product, categorySlugs: assigned.slugs, categories: assigned.names } : product;
    }),
    source: 'database',
  };
}

/** Drop the shared copy so the next read hits the database again. */
export function invalidateCatalogue() {
  cache = null;
}

export function useCatalogue(): CatalogueResult {
  const [state, setState] = useState<CatalogueResult>({
    products: fallbackProducts,
    loading: true,
    source: 'bundled',
  });

  useEffect(() => {
    let live = true;
    cache = cache ?? fetchCatalogue();
    cache
      .then((result) => {
        if (live) setState({ ...result, loading: false });
      })
      .catch(() => {
        if (live) setState({ products: fallbackProducts, loading: false, source: 'bundled' });
      });
    return () => { live = false; };
  }, []);

  return state;
}

/** A single product by slug, from the same shared catalogue. */
export function useProduct(slug: string): { product: Product | null; loading: boolean } {
  const { products, loading } = useCatalogue();
  return { product: products.find((p) => p.slug === slug) ?? null, loading };
}
