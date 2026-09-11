import { categories } from '@/data/categories';
import CategoryDetailClient from './CategoryDetailClient';

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  return <CategoryDetailClient slug={params.slug} />;
}
