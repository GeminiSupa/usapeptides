import Link from 'next/link';

const resources = [
  { href: '/coa-database', title: 'Find a certificate of analysis', text: 'Look up the compound and match the lot number on your label to its analysis record.' },
  { href: '/bulk-discounts', title: 'Compare volume pricing', text: 'Review quantity tiers and estimate the price of a larger laboratory order.' },
  { href: '/shipping-policy', title: 'Review shipping information', text: 'Check processing, delivery and tracking information before placing an order.' },
  { href: '/contact-us', title: 'Ask about documentation', text: 'Include the product name and lot number when asking about a report or specification.' },
];

export default function ResearchResources({ currentPath }: { currentPath?: string }) {
  return <section className="space-y-4 border-t border-brand-border pt-8" aria-label="Research purchasing resources">
    <h2 className="section-title">Before placing a research order</h2>
    <p className="max-w-3xl text-sm text-brand-textMuted">Review the product specifications and available documentation against your laboratory’s requirements. Contact support if a detail or matching report is missing.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {resources.filter((resource) => resource.href !== currentPath).map((resource) => <div key={resource.href} className="surface p-5">
        <Link href={resource.href} className="font-semibold text-brand-heading underline underline-offset-4">{resource.title}</Link>
        <p className="mt-2 text-sm text-brand-textMuted">{resource.text}</p>
      </div>)}
    </div>
  </section>;
}
