import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articles as fallbackArticles } from '@/data/articles';
import { ARTICLES_TAG, getSiteContent, publicRest } from '@/lib/siteContentServer';
import { faqSchema, jsonLd, siteUrl } from '@/lib/seo';
import ArticleDetailClient, { type ArticleExtras } from './ArticleDetailClient';

export function generateStaticParams() {
  return fallbackArticles.map((a) => ({ slug: a.slug }));
}

interface Props { params: { slug: string } }

interface DbArticle extends ArticleExtras {
  id: string; slug: string; title: string; excerpt: string; content: string; category: string; author: string;
  image: string | null; read_time: string; published_at: string | null; updated_at?: string | null; tags: string[] | null;
}

/** Published posts only: row-level security hides drafts from the public key. */
async function fetchArticle(slug: string): Promise<DbArticle | null> {
  const rows = await publicRest<DbArticle[]>(`articles?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, [ARTICLES_TAG]);
  return rows?.[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await fetchArticle(params.slug);
  const fallback = fallbackArticles.find((a) => a.slug === params.slug);
  if (!db && !fallback) return {};

  const title = db?.meta_title || db?.title || fallback?.title || '';
  const description = db?.meta_description || db?.excerpt || fallback?.excerpt || (db?.content ?? '').replace(/[#*_>\[\]()!-]/g, '').slice(0, 160).trim();
  const image = db?.og_image || db?.image || undefined;
  const path = `/blog/${params.slug}`;

  return {
    title,
    description,
    keywords: db?.keywords?.length ? db.keywords : (db?.tags ?? fallback?.tags ?? undefined),
    alternates: { canonical: db?.canonical_url || path },
    robots: db?.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'article',
      title,
      description,
      url: path,
      publishedTime: db?.published_at ?? undefined,
      modifiedTime: db?.updated_at ?? undefined,
      authors: db?.author ? [db.author] : undefined,
      images: image ? [{ url: image, alt: db?.image_alt ?? title }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const [db, content] = await Promise.all([fetchArticle(params.slug), getSiteContent()]);
  if (!db && !fallbackArticles.some((a) => a.slug === params.slug)) notFound();
  const faq = Array.isArray(db?.faq) ? db!.faq.filter((f) => f?.question && f?.answer) : [];
  const url = `${siteUrl()}/blog/${params.slug}`;

  const article = db && {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: db.meta_title || db.title,
    description: db.meta_description || db.excerpt,
    image: db.og_image || db.image || undefined,
    datePublished: db.published_at ?? undefined,
    dateModified: db.updated_at ?? db.published_at ?? undefined,
    author: { '@type': 'Person', name: db.author },
    publisher: { '@type': 'Organization', name: content['business.name'], logo: { '@type': 'ImageObject', url: `${siteUrl()}/logo.png` } },
    mainEntityOfPage: url,
    keywords: (db.keywords?.length ? db.keywords : db.tags ?? []).join(', ') || undefined,
  };
  const faqLd = faqSchema(faq);

  return (
    <>
      {article && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(article)} />}
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />}
      <ArticleDetailClient slug={params.slug} extras={db ? { faq, image_alt: db.image_alt ?? null } : undefined}
        initial={db ? {
          id: db.id, slug: db.slug, title: db.title, excerpt: db.excerpt, content: db.content, category: db.category,
          author: db.author, readTime: db.read_time, image: db.image || '/products/vial-1.jpg', tags: db.tags ?? [],
          date: db.published_at ? new Date(db.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        } : undefined} />
    </>
  );
}
