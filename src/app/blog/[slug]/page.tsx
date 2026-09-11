import { articles } from '@/data/articles';
import ArticleDetailClient from './ArticleDetailClient';

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export default function ArticleDetailPage({ params }: ArticlePageProps) {
  return <ArticleDetailClient slug={params.slug} />;
}
