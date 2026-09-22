import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { mapDbProduct, type DbProduct } from '@/lib/catalogue';
import type { Product } from '@/types';
import { products } from '@/data/products';
import { publicRest } from '@/lib/siteContentServer';
import { jsonLd, siteUrl } from '@/lib/seo';
import { BUSINESS } from '@/lib/env';
import ProductDetailClient from './ProductDetailClient';

/**
 * Prerenders the bundled catalogue at build time. Products added in the
 * dashboard afterwards are not listed here and are rendered on demand instead,
 * which is why this is a hint rather than the full set.
 */
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

interface Props { params: Promise<{ slug: string }> }

// Metadata, structured data and the first visible render share the same record.
const fetchProduct = cache(async (slug: string): Promise<Product | null> => {
  const rows = await publicRest<DbProduct[]>(
    `products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*&limit=1`,
    ['catalogue']
  );
  if (rows !== null) return rows[0] ? mapDbProduct(rows[0]) : null;
  return products.find((x) => x.slug === slug) ?? null;
});

const absolute = (url: string | null) => (url ? (url.startsWith('/') ? `${siteUrl()}${url}` : url) : undefined);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchProduct(slug);
  if (!p) return {};
  const description = (p.description || `${p.name}. View research-product specifications and available documentation.`).slice(0, 160);
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, url: `/product/${p.slug}`, images: p.image ? [{ url: absolute(p.image)! }] : undefined },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const p = await fetchProduct(slug);
  if (!p) notFound();
  const schema = p && {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku ?? undefined,
    description: p.description ?? undefined,
    image: absolute(p.image),
    category: p.category ?? undefined,
    brand: { '@type': 'Brand', name: BUSINESS.name },
    offers: {
      '@type': 'Offer',
      url: `${siteUrl()}/product/${p.slug}`,
      priceCurrency: BUSINESS.currency,
      // The product page and cart use the base price for one vial.
      price: p.price.toFixed(2),
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
  return (
    <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />}
      <ProductDetailClient slug={slug} initialProduct={p} />
    </>
  );
}
