import { BUSINESS } from '@/lib/env';
import { PageHeader, Prose, Bullets, Disclosure, Related, ResearchUseNote } from '@/components/Longform';
import {
  GLOSSARY,
  GLOSSARY_NOTE,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_FAQS,
  KNOWLEDGE_INTRO,
  type Block,
} from '@/content/knowledgeCenter';

const NAME = BUSINESS.name;

function Blocks({ body }: { body: Block[] }) {
  return (
    <>
      {body.map((block, i) => {
        if (block.type === 'p') return <Prose key={i} body={[block.text]} muted />;
        if (block.type === 'ul') return <Bullets key={i} items={block.items} />;
        return (
          <ol key={i} className="space-y-4">
            {block.items.map((item, n) => (
              <li key={item.title} className="flex gap-4">
                <span className="font-display text-sm font-extrabold text-brand-accentGlow">
                  {String(n + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xs font-extrabold uppercase tracking-wide text-brand-heading">
                    {item.title}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-brand-textMuted">
                    {item.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
}

export default function KnowledgeCenterPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Knowledge Center"
        title="What the documentation actually says"
        lede="Read the report, not the headline number."
        intro={KNOWLEDGE_INTRO}
      />

      <section className="space-y-6">
        <h2 className="section-title">Core topics</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-brand-body">
          Each topic opens in place. Start anywhere — they are written to be read on their own.
        </p>
        <div className="space-y-4">
          {KNOWLEDGE_ARTICLES.map((article) => (
            <div key={article.id} id={article.id} className="scroll-mt-24">
              <Disclosure summary={article.title} kicker="Knowledge Center">
                <Prose body={[article.summary]} />
                <Blocks body={article.body} />
                {article.related && article.related.length > 0 && (
                  <div className="pt-2">
                    <Related links={article.related} />
                  </div>
                )}
              </Disclosure>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="section-title">Common analytical terms</h2>
        <dl className="grid gap-px border border-brand-border bg-brand-border sm:grid-cols-2">
          {GLOSSARY.map((entry) => (
            <div key={entry.term} className="bg-brand-card p-5">
              <dt className="font-display text-xs font-extrabold uppercase tracking-wide text-brand-heading">
                {entry.term}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-brand-textMuted">{entry.definition}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-3xl text-xs leading-relaxed text-brand-textMuted">{GLOSSARY_NOTE}</p>
      </section>

      <section className="space-y-6">
        <h2 className="section-title">Research peptides and laboratory handling</h2>
        <div className="space-y-3">
          {KNOWLEDGE_FAQS.map((faq) => (
            <Disclosure key={faq.question} summary={faq.question} openLabel="Answer">
              <Prose body={[faq.answer]} muted />
            </Disclosure>
          ))}
        </div>
      </section>

      <Related
        links={[
          { href: '/coa-database', label: 'Search the COA database' },
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
