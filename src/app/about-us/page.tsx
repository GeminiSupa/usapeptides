import { BUSINESS } from '@/lib/env';
import { PageHeader, Prose, Bullets, StatementCard, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const PILLARS: { title: string; body: string }[] = [
  {
    title: 'Clear product identification',
    body: 'You should always know exactly what is in the vial, starting with what the product is and how it is identified.',
  },
  {
    title: 'Lot-specific documentation',
    body: 'Documentation is organized by lot, so a report can be matched to the material that was actually shipped to you.',
  },
  {
    title: 'Independent analytical testing',
    body: 'Where independent analysis is available, the supporting documentation is made accessible rather than summarized into a claim.',
  },
  {
    title: 'Domestic fulfillment',
    body: 'Orders are stocked and dispatched from the United States with tracking.',
  },
  {
    title: 'Responsive support',
    body: 'Questions about identity, documentation, order status or shipping go to a team that answers them.',
  },
];

export default function AboutUsPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow={`About ${NAME}`}
        title="Why trust what you can test?"
        lede="Never trust what you can test."
        intro={[
          `${NAME} is a U.S.-based supplier of research peptides and laboratory reference materials built on a simple principle.`,
        ]}
      />

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="section-title">Clear evidence for real research</h2>
          <Prose
            body={[
              'Bottom line: you should always know exactly what is in the vial. That means clear product identification, lot-specific documentation, independent analytical testing (where available), domestic fulfillment, and responsive support.',
              `Every step of ${NAME}'s process is built for maximum traceability, transparency, and consistency — from sourcing and documentation to fulfillment and customer support.`,
            ]}
          />
        </div>
        <StatementCard
          quote="Don’t believe the hype. Believe the results."
          tagline="That’s Trust. Verified."
        />
      </section>

      <section className="space-y-6">
        <h2 className="section-title">What that means in practice</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="border border-brand-border bg-brand-card p-6">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
                {pillar.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-textMuted">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="section-title">The questions we built the company around</h2>
        <Bullets
          items={[
            'What was actually tested?',
            'When was it tested?',
            'Does the documentation match the lot you ordered?',
          ]}
        />
      </section>

      <Related
        links={[
          { href: '/our-story', label: 'Read our story' },
          { href: '/our-team', label: 'Our team and leadership' },
          { href: '/why-us', label: `Why ${NAME}` },
          { href: '/quality-standards', label: 'Quality standards' },
          { href: '/coa-database', label: 'Search the COA database' },
        ]}
      />

      <ResearchUseNote>
        {`Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
