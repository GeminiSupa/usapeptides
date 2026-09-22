import Link from 'next/link';

export default function AboutUsPage() {
  return (
    <div className="shell space-y-14 py-12">
      <header className="max-w-3xl border-b border-brand-border pb-8">
        <p className="eyebrow mb-3">About USA Peptide Depot</p>
        <h1 className="page-title">Why trust what you can test?</h1>
        <p className="mt-4 text-sm leading-relaxed text-brand-body">USA Peptide Depot is a U.S.-based supplier of research peptides and laboratory reference materials built on one simple principle: never trust what you can test.</p>
      </header>
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5 text-sm leading-relaxed text-brand-body">
          <h2 className="section-title">Clear evidence for real research</h2>
          <p>Anyone can print a purity number on a label. We focus on clear product identification, lot-specific documentation, independent analytical testing where available, domestic fulfillment, and responsive support.</p>
          <p>Every step of the process is built for traceability, transparency, and consistency — from sourcing and documentation to fulfillment and customer support.</p>
        </div>
        <div className="border border-brand-border bg-brand-card p-6"><p className="eyebrow mb-3 text-brand-accentGlow">Our standard</p><p className="font-display text-xl font-extrabold uppercase leading-tight text-brand-heading">Don’t believe the hype. Believe the results.</p><p className="mt-4 text-sm text-brand-textMuted">That’s Trust. <em>Verified.</em></p></div>
      </section>
      <section className="grid gap-5 md:grid-cols-3">
        {[
          ['Document every lot', 'We make the documentation that exists for a lot easy to find and understand.'],
          ['Keep the facts clear', 'We separate verifiable information from marketing language and unsupported claims.'],
          ['Support the work', 'Direct support helps researchers find product, shipping, and documentation answers.'],
        ].map(([title, body]) => <article key={title} className="border border-brand-border bg-brand-card p-6"><h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">{title}</h2><p className="mt-3 text-sm leading-relaxed text-brand-textMuted">{body}</p></article>)}
      </section>
      <div className="flex flex-wrap gap-3"><Link href="/our-story" className="btn-primary">Read our story</Link><Link href="/quality-standards" className="btn-ghost">Quality standards</Link></div>
      <p className="border-t border-brand-border pt-6 text-xs leading-relaxed text-brand-textMuted">Products sold by USA Peptide Depot are intended for laboratory and research use only and are not intended for human or veterinary use.</p>
    </div>
  );
}
