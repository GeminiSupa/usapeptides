import { BUSINESS } from '@/lib/env';
import { PageHeader, Step, Related, ResearchUseNote } from '@/components/Longform';

const NAME = BUSINESS.name;

const STEPS: { title: string; summary: string }[] = [
  {
    title: 'Select your research material',
    summary:
      'Browse our online catalog and review the product information, specifications, and available documentation before ordering.',
  },
  {
    title: 'Review',
    summary:
      'Use our COA database to review the compound, lot number, testing laboratory, test date, and reported results.',
  },
  {
    title: 'Ordering',
    summary:
      // The writer's line ends "and our Terms and Conditions". That page is
      // section 13 of his document and has not been written, so the copy
      // points at the policies that do exist. Restore his wording, and the
      // link, once the Terms page is live.
      'Complete checkout using the payment methods offered on the site. Orders are subject to availability, verification, and the shipping and return policies published on this site.',
  },
  {
    title: 'Shipping',
    summary:
      'Once processed, orders are packed and shipped from the United States with tracking information.',
  },
  {
    title: 'Verify',
    summary:
      'When your order arrives, compare the lot information on the product with the applicable documentation in the COA database.',
  },
  {
    title: 'Support',
    summary:
      'If documentation is missing, unclear, or does not match the material received, contact support before proceeding with your research.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="shell space-y-12 py-12">
      <PageHeader
        eyebrow="How it works"
        title="Find it. Check it. Order it."
        lede="Six steps, from the catalog to the documentation that matches your lot."
        intro={[`Ordering from ${NAME} is organized around a simple research workflow: choose the material, read the documentation, order, receive, verify the lot, and ask us if anything does not match.`]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {STEPS.map((step, i) => (
          <Step key={step.title} number={i + 1} title={step.title} summary={step.summary} />
        ))}
      </div>

      <Related
        links={[
          { href: '/shop', label: 'Browse the catalogue' },
          { href: '/coa-database', label: 'Search the COA database' },
          { href: '/knowledge-center', label: 'Knowledge Center' },
          { href: '/faq', label: 'Read the FAQ' },
          { href: '/contact-us', label: 'Contact support' },
        ]}
      />

      <ResearchUseNote />
    </div>
  );
}
