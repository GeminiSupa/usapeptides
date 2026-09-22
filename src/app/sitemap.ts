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
  const now = new Date();

  const [products, categories, articles] = await Promise.all([
    publicRest<{ slug: string; updated_at: string }[]>('products?select=slug,updated_at&is_active=eq.true', ['catalogue']),
    publicRest<{ slug: string; updated_at: string }[]>('product_categories?select=slug,updated_at&is_active=eq.true', ['catalogue']),
    // noindex is left out of the select so this still works before 0015.
    publicRest<{ slug: string; published_at: string }[]>('articles?select=slug,published_at', [ARTICLES_TAG]),
  ]);

  const pages = ['', '/shop', '/coa-database', '/bulk-discounts', '/calculator', '/blog', '/about-us', '/faq', '/contact-us', '/affiliates',
    '/privacy-policy', '/shipping-policy', '/return-refund-policy'];

  const hidden = new Set(
    (await publicRest<{ slug: string }[]>('articles?select=slug&noindex=eq.true', [ARTICLES_TAG]) ?? []).map((a) => a.slug)
  );

  return [
    ...pages.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...(products?.length ? products : fallbackProducts.map((p) => ({ slug: p.slug, updated_at: '' }))).map((p) => ({
      url: `${base}/product/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : now, changeFrequency: 'weekly' as const, priority: 0.8,
    })),
    ...(categories?.length ? categories : fallbackCategories.map((c) => ({ slug: c.slug, updated_at: '' }))).map((c) => ({
      url: `${base}/category/${c.slug}`, lastModified: c.updated_at ? new Date(c.updated_at) : now, changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    ...(articles?.length ? articles : fallbackArticles.map((a) => ({ slug: a.slug, published_at: '' })))
      .filter((a) => !hidden.has(a.slug))
      .map((a) => ({
        url: `${base}/blog/${a.slug}`, lastModified: a.published_at ? new Date(a.published_at) : now, changeFrequency: 'monthly' as const, priority: 0.6,
      })),
  ];
}
