import type { Metadata } from 'next';
import { categories } from '@/data/categories';
import { publicRest } from '@/lib/siteContentServer';
import CategoryDetailClient from './CategoryDetailClient';

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const rows = await publicRest<{ name: string; description: string }[]>(
    `product_categories?slug=eq.${encodeURIComponent(params.slug)}&select=name,description&limit=1`, ['catalogue']
  );
  const c = rows?.[0] ?? categories.find((x) => x.slug === params.slug);
  if (!c) return {};
  return {
    title: c.name,
    description: c.description?.slice(0, 160) || undefined,
    alternates: { canonical: `/category/${params.slug}` },
  };
}

export default function CategoryPage({ params }: Props) {
  return <CategoryDetailClient slug={params.slug} />;
}
