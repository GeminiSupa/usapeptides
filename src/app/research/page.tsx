import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/env';
import { PageHeader, Related, ResearchUseNote } from '@/components/Longform';
import {
  GLOSSARY_NOTE,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_INTRO,
  researchHref,
} from '@/content/knowledgeCenter';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('knowledge', '/research');

const NAME = BUSINESS.name;

export default function ResearchIndexPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Research"
        title="What the documentation actually says"
        lede="Read the report, not the headline number."
        intro={KNOWLEDGE_INTRO}
      />

      <section className="space-y-6">
        <h2 className="section-title">Core topics</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-brand-body">
          Each topic is its own page. Start anywhere — they are written to be read on their own.
        </p>
        <ul className="divide-y divide-brand-border border border-brand-border bg-brand-card">
          {KNOWLEDGE_ARTICLES.map((article) => (
            <li key={article.id}>
              <Link href={researchHref(article.id)} className="block p-5 transition-colors hover:bg-brand-cardHover">
                <span className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
                  {article.title}
                </span>
                <span className="mt-2 block max-w-[68ch] text-sm leading-relaxed text-brand-textMuted">
                  {article.summary}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/research/glossary" className="block p-5 transition-colors hover:bg-brand-cardHover">
              <span className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
                Common analytical terms and laboratory definitions
              </span>
              <span className="mt-2 block max-w-[68ch] text-sm leading-relaxed text-brand-textMuted">
                {GLOSSARY_NOTE}
              </span>
            </Link>
          </li>
          <li>
            <Link href="/research/laboratory-handling" className="block p-5 transition-colors hover:bg-brand-cardHover">
              <span className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
                Research peptides and laboratory handling
              </span>
              <span className="mt-2 block max-w-[68ch] text-sm leading-relaxed text-brand-textMuted">
                Answers about research-use classification, independent testing, lot matching, storage, and handling.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <Related
        links={[
          { href: '/coa-database', label: 'Search the COA database' },
          { href: '/blog', label: 'Research & test results' },
          { href: '/quality-standards', label: 'Quality standards' },
          { href: '/how-it-works', label: 'How it works' },
          { href: '/faq', label: 'General FAQ' },
          { href: '/contact-us', label: 'Contact support' },
        ]}
      />

      <ResearchUseNote>
        {`Educational content is for informational purposes and does not replace laboratory protocols, institutional requirements, manufacturer instructions, or professional scientific judgment. Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
