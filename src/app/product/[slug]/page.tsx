import type { Metadata } from 'next';
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

interface Props { params: { slug: string } }

interface Row {
  name: string; slug: string; description: string | null; image: string | null; sku: string | null;
  price: number; sale_price: number | null; in_stock: boolean; category: string | null; purity: string | null;
}

async function fetchProduct(slug: string): Promise<Row | null> {
  const rows = await publicRest<Row[]>(
    `products?slug=eq.${encodeURIComponent(slug)}&select=name,slug,description,image,sku,price,sale_price,in_stock,category,purity&limit=1`,
    ['catalogue']
  );
  if (rows?.[0]) return rows[0];
  const p = products.find((x) => x.slug === slug);
  return p ? { name: p.name, slug: p.slug, description: p.description, image: p.image, sku: p.sku, price: p.price,
    sale_price: p.salePrice ?? null, in_stock: p.inStock, category: p.category, purity: p.purity } : null;
}

const absolute = (url: string | null) => (url ? (url.startsWith('/') ? `${siteUrl()}${url}` : url) : undefined);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await fetchProduct(params.slug);
  if (!p) return {};
  const description = (p.description || `${p.name}${p.purity ? `, ${p.purity} purity` : ''}. HPLC tested research compound.`).slice(0, 160);
  return {
    title: p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, url: `/product/${p.slug}`, images: p.image ? [{ url: absolute(p.image)! }] : undefined },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const p = await fetchProduct(params.slug);
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
      price: Number(p.sale_price ?? p.price).toFixed(2),
      availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
  return (
    <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />}
      <ProductDetailClient slug={params.slug} />
    </>
  );
}
