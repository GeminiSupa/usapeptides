import { BUSINESS } from '@/lib/env';
import { PageHeader, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const REASONS: { title: string; body: string[] }[] = [
  {
    title: 'Evidence > claims',
    body: [
      'Claims mean nothing without backup, and HPLC analysis alone is not enough.',
      `${NAME} ensures every test is lot-specific so researchers know it matches the material they ordered.`,
    ],
  },
  {
    title: 'Independent testing',
    body: [
      'Independent testing is vital. We test with third parties and make the results available, so you know what is on our label is in the vial.',
    ],
  },
  {
    title: 'Domestic fulfillment',
    body: [
      'Domestic fulfillment means no delays or lost orders.',
      `Every ${NAME} order is stocked and dispatched from the United States with tracking.`,
    ],
  },
  {
    title: 'Support that answers',
    body: [
      `Have questions about identity, documentation, order status, or shipping? ${NAME}'s support staff will answer them.`,
    ],
  },
];

export default function WhyUsPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Why us"
        title={`Why ${NAME}`}
        lede="Evidence over claims, lot by lot."
        intro={[
          'Four things separate a documented research material from a well-designed label: lot-specific testing, independent analysis, fulfillment you can track, and people who answer questions.',
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {REASONS.map((reason) => (
          <article key={reason.title} className="border border-brand-border bg-brand-card p-6">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
              {reason.title}
            </h2>
            <div className="mt-3 space-y-3">
              {reason.body.map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-brand-textMuted">
                  {para}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>

      <Related
        links={[
          { href: '/shop', label: 'Shop research materials' },
          { href: '/how-it-works', label: 'How it works' },
          { href: '/about-us', label: 'About our standards' },
          { href: '/quality-standards', label: 'Quality standards' },
        ]}
      />

      <ResearchUseNote />
    </div>
  );
}
