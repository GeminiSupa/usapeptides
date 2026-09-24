import { BUSINESS } from '@/lib/env';
import { PageHeader, Prose, Bullets, StatementCard, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

export default function OurStoryPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Our story"
        title="Too many claims. Too little proof."
        lede="All hat. No cattle."
        intro={[
          `${NAME} was founded to solve the biggest problem in research peptides: purity numbers can be printed. Just because a label looks professional doesn't mean it is. Marketing claims may sound scientific, but where's the support?`,
        ]}
      />

      <section className="space-y-6">
        <h2 className="section-title">The questions nobody was answering</h2>
        <Bullets
          items={[
            'What was actually tested?',
            'When was it tested?',
            'Does the documentation match the lot you ordered?',
          ]}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="section-title">What we built instead</h2>
          <Prose
            body={[
              `We built ${NAME} to meet the highest standards. Where independent analysis is available, we make the supporting documentation accessible.`,
              'We organize products and lots so researchers can verify what they received.',
              'We prioritize evidence over hype and clarity over claims.',
            ]}
          />
        </div>
        <StatementCard quote="The idea is straightforward: Trust. Verified." />
      </section>

      <Related
        links={[
          { href: '/about-us', label: `About ${NAME}` },
          { href: '/our-team', label: 'Our team and leadership' },
          { href: '/coa-database', label: 'Search the COA database' },
          { href: '/contact-us', label: 'Contact support' },
        ]}
      />

      <ResearchUseNote />
    </div>
  );
}
