import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BUSINESS } from '@/lib/env';
import KnowledgeBlocks from '@/components/KnowledgeBlocks';
import { PageHeader, Related, ResearchUseNote } from '@/components/Longform';
import { getKnowledgeArticle, KNOWLEDGE_ARTICLES } from '@/content/knowledgeCenter';

const NAME = BUSINESS.name;

export function generateStaticParams() {
  return KNOWLEDGE_ARTICLES.map((article) => ({ slug: article.id }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getKnowledgeArticle(params.slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/research/${article.id}` },
  };
}

export default function ResearchArticlePage({ params }: { params: { slug: string } }) {
  const article = getKnowledgeArticle(params.slug);
  if (!article) notFound();

  return (
    <div className="shell space-y-10 py-12">
      <PageHeader eyebrow="Research" title={article.title} intro={[article.summary]} />
      <KnowledgeBlocks body={article.body} />
      {article.related && article.related.length > 0 && <Related links={article.related} />}
      <p>
        <Link href="/research" className="text-sm text-brand-accentGlow hover:underline">
          All research topics
        </Link>
      </p>
      <ResearchUseNote>
        {`Educational content is for informational purposes and does not replace laboratory protocols, institutional requirements, manufacturer instructions, or professional scientific judgment. Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
