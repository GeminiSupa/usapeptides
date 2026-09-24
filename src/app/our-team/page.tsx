import { BUSINESS } from '@/lib/env';
import { PageHeader, Prose, StatementCard, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const STANDARDS: { title: string; body: string }[] = [
  {
    title: 'Document every lot',
    body: 'Each lot carries its own records, so documentation can be matched to the material that was shipped.',
  },
  {
    title: 'Deliver full operational accountability',
    body: 'Sourcing, fulfillment and support stay close together, so a question about a product, a report or an order has one clear path.',
  },
  {
    title: 'Make verification transparent and effortless',
    body: 'Where analysis exists, it is published in a form a researcher can check rather than summarized into a claim.',
  },
];

export default function OurTeamPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Our team and leadership"
        title="Operations first"
        lede="We believe the evidence should do the talking."
        intro={[
          `${NAME}'s leadership is operations-first. We focus on the bedrock essentials: rigorous sourcing, lot-specific documentation, and direct support.`,
        ]}
      />

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <h2 className="section-title">The standards we hold ourselves to</h2>
          <Prose
            body={[
              `${NAME} follows these standards so that the evidence, rather than the marketing, describes the material.`,
            ]}
          />
          <div className="space-y-4">
            {STANDARDS.map((standard) => (
              <article key={standard.title} className="border border-brand-border bg-brand-card p-5">
                <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
                  {standard.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-textMuted">{standard.body}</p>
              </article>
            ))}
          </div>
        </div>
        <StatementCard
          quote="No promotional hype. No inflated results. No unsupported claims."
          tagline="Just facts. Verifiable facts."
        />
      </section>

      <section className="border border-brand-border bg-brand-card p-6">
        <p className="eyebrow mb-3 text-brand-accentGlow">Leadership</p>
        <p className="max-w-2xl text-sm leading-relaxed text-brand-body">
          Named biographies, titles and credentials for the leadership team are being finalized and
          will be published here. Until they are, we would rather show nothing than something we have
          not verified — which is the whole point of the page.
        </p>
      </section>

      <Related
        links={[
          { href: '/about-us', label: `About ${NAME}` },
          { href: '/our-story', label: 'Our story' },
          { href: '/quality-standards', label: 'Quality standards' },
          { href: '/contact-us', label: 'Contact support' },
        ]}
      />

      <ResearchUseNote />
    </div>
  );
}
