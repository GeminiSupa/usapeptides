import { BUSINESS } from '@/lib/env';
import { PageHeader, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const STANDARDS: { title: string; body: string }[] = [
  {
    title: 'Accuracy',
    body: 'We draw a bright line between verified facts and sales and marketing claims. Claims are supported by credible sources and confined to the limits of the available evidence.',
  },
  {
    title: 'Sources',
    body: 'Articles should rely on research, scientific publications, analytical laboratory documentation, or other authoritative sources. Where published material conflicts or uncertainty remains, that is stated plainly.',
  },
  {
    title: 'Peptide science',
    body: 'Peptides are an emerging area of research. What is known today may evolve as more work is done. Editorial content is updated to reflect the present state of that knowledge.',
  },
  {
    title: 'Research use',
    body: 'Editorial content does not provide medical advice, dosing instructions, treatment recommendations, or guidance for human or veterinary use of products sold on this site. Every peptide we sell is for research use only.',
  },
];

export default function EditorialPolicyPage() {
  return (
    <div className="shell space-y-14 py-12">
      <PageHeader
        eyebrow="Editorial policy"
        title="Evidence first. Evidence last."
        lede="Trust. Verified."
        intro={[
          `${NAME} publishes educational content to improve transparency and understanding about the research materials we offer. Our editorial standard is simple.`,
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {STANDARDS.map((item) => (
          <article key={item.title} className="border border-brand-border bg-brand-card p-6">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-textMuted">{item.body}</p>
          </article>
        ))}
      </div>

      <Related
        links={[
          { href: '/research', label: 'Research' },
          { href: '/quality-standards', label: 'Quality standards' },
          { href: '/faq', label: 'FAQ' },
        ]}
      />

      <ResearchUseNote />
    </div>
  );
}
