import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { ARTICLES_TAG, publicRest } from '@/lib/siteContentServer';
import { products as fallbackProducts } from '@/data/products';
import { categories as fallbackCategories } from '@/data/categories';
import { articles as fallbackArticles } from '@/data/articles';

export const revalidate = 3600;

/** Every public page, product, category and published blog post. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [products, categories, articles] = await Promise.all([
    publicRest<{ slug: string; updated_at: string }[]>('products?select=slug,updated_at&is_active=eq.true', ['catalogue']),
    publicRest<{ slug: string; updated_at: string }[]>('product_categories?select=slug,updated_at&is_active=eq.true', ['catalogue']),
    // noindex is left out of the select so this still works before 0015.
    publicRest<{ slug: string; published_at: string; updated_at?: string }[]>('articles?select=slug,published_at,updated_at', [ARTICLES_TAG]),
  ]);

  const pages = ['', '/shop', '/coa-database', '/bulk-discounts', '/calculator', '/blog', '/about-us', '/faq', '/install', '/contact-us', '/affiliates',
    '/privacy-policy', '/shipping-policy', '/return-refund-policy'];

  const hidden = new Set(
    (await publicRest<{ slug: string }[]>('articles?select=slug&noindex=eq.true', [ARTICLES_TAG]) ?? []).map((a) => a.slug)
  );

  return [
    // Omit unknown dates rather than implying every regeneration changes content.
    ...pages.map((p) => ({ url: `${base}${p}` })),
    ...(products ?? fallbackProducts.map((p) => ({ slug: p.slug, updated_at: '' }))).map((p) => ({
      url: `${base}/product/${p.slug}`, lastModified: validDate(p.updated_at),
    })),
    ...(categories ?? fallbackCategories.map((c) => ({ slug: c.slug, updated_at: '' }))).map((c) => ({
      url: `${base}/category/${c.slug}`, lastModified: validDate(c.updated_at),
    })),
    ...(articles ?? fallbackArticles.map((a) => ({ slug: a.slug, published_at: '', updated_at: '' })))
      .filter((a) => !hidden.has(a.slug))
      .map((a) => ({
        url: `${base}/blog/${a.slug}`, lastModified: validDate(a.updated_at || a.published_at),
      })),
  ];
}

function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
