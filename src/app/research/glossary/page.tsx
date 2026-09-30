import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/env';
import { PageHeader, Related, ResearchUseNote } from '@/components/Longform';
import { GLOSSARY, GLOSSARY_NOTE } from '@/content/knowledgeCenter';

const NAME = BUSINESS.name;

export const metadata: Metadata = {
  title: 'Common analytical terms and laboratory definitions',
  description: GLOSSARY_NOTE,
  alternates: { canonical: '/research/glossary' },
};

export default function GlossaryPage() {
  return (
    <div className="shell space-y-10 py-12">
      <PageHeader
        eyebrow="Research"
        title="Common analytical terms"
        intro={[GLOSSARY_NOTE]}
      />
      <dl className="grid gap-px border border-brand-border bg-brand-border sm:grid-cols-2 xl:grid-cols-3">
        {GLOSSARY.map((entry) => (
          <div key={entry.term} className="bg-brand-card p-5">
            <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-brand-heading">
              {entry.term}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-brand-textMuted">{entry.definition}</dd>
          </div>
        ))}
      </dl>
      <Related
        links={[
          { href: '/research', label: 'All research topics' },
          { href: '/coa-database', label: 'COA database' },
          { href: '/quality-standards', label: 'Quality standards' },
        ]}
      />
      <ResearchUseNote>
        {`Educational content is for informational purposes and does not replace laboratory protocols, institutional requirements, manufacturer instructions, or professional scientific judgment. Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
