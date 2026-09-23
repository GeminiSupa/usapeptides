import type { Product } from '@/types';
import { products as fallbackProducts } from '@/data/products';

/**
 * One translation between the `products` table and the storefront's `Product`
 * shape. Every page that shows a product goes through here, so a column rename
 * is a single edit rather than a hunt through twenty files.
 *
 * The database is the source of truth. `src/data/products.ts` is only a
 * fallback for when Supabase is unreachable or empty, so a cold deployment
 * still renders a catalogue instead of an empty shop.
 */

export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  category_slug: string | null;
  price: number | string;
  sale_price: number | string | null;
  sku: string | null;
  purity: string | null;
  sequence: string | null;
  cas_number: string | null;
  molar_mass: string | null;
  formula: string | null;
  storage: string | null;
  appearance: string | null;
  description: string | null;
  details: unknown;
  specs: unknown;
  bulk_pricing: unknown;
  coa: unknown;
  coa_url: string | null;
  coa_lot: string | null;
  coa_tested_at: string | null;
  image: string | null;
  detail_image: string | null;
  tags: string[] | null;
  in_stock: boolean;
  stock_count: number;
  is_featured: boolean;
  is_popular: boolean;
  is_active: boolean;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Bulk tiers the storefront falls back to when a product defines none. */
export const DEFAULT_BULK_TIERS = [
  { tier: '1-2 Vials', quantity: '1-2', discountPercent: 0 },
  { tier: '3-4 Vials', quantity: '3-4', discountPercent: 10 },
  { tier: '5-9 Vials', quantity: '5-9', discountPercent: 15 },
  { tier: '10+ Vials', quantity: '10+', discountPercent: 20 },
];

export function mapDbProduct(row: DbProduct): Product {
  const price = num(row.price);
  const coa = (row.coa ?? {}) as Record<string, string>;

  const bulk = list<Product['bulkPricing'][number]>(row.bulk_pricing);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category ?? 'Research Peptides',
    categorySlug: row.category_slug ?? 'research-peptides',
    price,
    salePrice: row.sale_price == null ? undefined : num(row.sale_price),
    inStock: row.in_stock && row.stock_count > 0,
    stockCount: num(row.stock_count),
    sku: row.sku ?? '',
    purity: row.purity ?? '',
    sequence: row.sequence ?? undefined,
    casNumber: row.cas_number ?? undefined,
    molarMass: row.molar_mass ?? undefined,
    formula: row.formula ?? undefined,
    storage: row.storage ?? '-20°C lyophilized, protect from light',
    appearance: row.appearance ?? 'White lyophilized powder',
    description: row.description ?? '',
    details: list<string>(row.details),
    specs: list<Product['specs'][number]>(row.specs),

    // A product with no tiers still shows the standing volume discounts rather
    // than an empty table, because the order API applies them either way.
    bulkPricing: bulk.length
      ? bulk
      : DEFAULT_BULK_TIERS.map((t) => ({
          ...t,
          pricePerUnit: Number((price * (1 - t.discountPercent / 100)).toFixed(2)),
        })),

    coa: {
      lotNumber: row.coa_lot || coa.lotNumber || '',
      testDate: row.coa_tested_at || coa.testDate || '',
      purity: row.purity || coa.purity || '',
      lab: coa.lab ?? 'Independent analytical laboratory',
      method: coa.method ?? 'RP-HPLC UV-214nm & ESI-MS',
      sampleType: coa.sampleType ?? 'Lyophilized polypeptide',
      status: (coa.status as 'PASSED' | 'VERIFIED') ?? 'VERIFIED',
      chromatogramPeak: coa.chromatogramPeak ?? '',
    },
    coaUrl: row.coa_url ?? undefined,

    image: row.image ?? '',
    detailImage: row.detail_image ?? row.image ?? '',
    tags: row.tags ?? [],
    isFeatured: row.is_featured,
    isPopular: row.is_popular,
  };
}

export function mapDbProducts(rows: DbProduct[] | null | undefined): Product[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapDbProduct);
}

export { fallbackProducts };
