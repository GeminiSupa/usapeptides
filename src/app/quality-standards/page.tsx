import { BUSINESS } from '@/lib/env';
import { PageHeader, Prose, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Lot identification',
    body: 'Products should be associated with clear lot or batch identifiers where applicable so documentation can be matched to the material supplied.',
  },
  {
    title: 'Independent analytical documentation',
    body: 'Where independent testing is available, we make the documentation accessible. HPLC data is reported by the testing laboratory. We never reframe results to make unsupported claims.',
  },
  {
    title: 'Documentation review',
    body: 'We review available laboratory analysis for information such as compound name, lot or sample reference, test date, laboratory, method, and reported findings before publication to the COA database.',
  },
  {
    title: 'Handling and fulfillment',
    body: 'Research materials are stored, packed, and fulfilled according to the handling requirements established for the applicable product and our operational procedures.',
  },
  {
    title: 'Issue resolution',
    body: 'If a documentation mismatch, labeling issue, shipping problem, or other quality concern is identified, we investigate the affected order or lot and take appropriate corrective action.',
  },
];

export default function QualityStandardsPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Quality standards"
        title="Documentation you can check"
        intro={[
          'Our quality standards begin with traceability. A label is not enough. Researchers must be able to identify what they ordered, match it to a tested lot, and review the available supporting documentation.',
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <article key={section.title} className="border border-brand-border bg-brand-card p-6">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-textMuted">{section.body}</p>
          </article>
        ))}
      </div>

      <Prose body={['Quality is not a single purity number. It is the system that connects identity, documentation, handling, traceability, and accountability.']} />

      <Related
        links={[
          { href: '/coa-database', label: 'Search COA database' },
          { href: '/research', label: 'Research' },
          { href: '/how-it-works', label: 'How it works' },
        ]}
      />

      <ResearchUseNote>
        {`Products sold by ${NAME} are intended for laboratory and research use only and are not intended for human or veterinary use.`}
      </ResearchUseNote>
    </div>
  );
}
