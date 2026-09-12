'use client';

import React from 'react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import TrustBar from '@/components/TrustBar';
import CategoryNav from '@/components/CategoryNav';
import ProductCard from '@/components/ProductCard';
import ReconstitutionCalculator from '@/components/ReconstitutionCalculator';
import { useCatalogue } from '@/hooks/useCatalogue';
import { articles } from '@/data/articles';
import { faqs } from '@/data/faqs';
import { ArrowRight, Check } from 'lucide-react';

/** Section header: tracked eyebrow, title, optional link on the right. */
function SectionHead({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow hover:text-brand-heading"
        >
          <span>{linkLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const { products } = useCatalogue();
  const featured = products.filter((p) => p.isFeatured || p.isPopular).slice(0, 8);
  const mostRequested = products.filter((p) => !featured.includes(p)).slice(0, 8);
  const homeFaqs = faqs.slice(0, 6);

  return (
    <div>
      {/* 1 - Hero */}
      <Hero />

      {/* 2 - Assurance row */}
      <TrustBar />

      {/* 3 - Premium research peptides */}
      <section className="shell py-20">
        <SectionHead
          eyebrow="In stock now"
          title="Premium research peptides"
          href="/shop"
          linkLabel="Shop all peptides"
        />
        <div className="rail">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 4 - Long-form positioning copy */}
      <section className="border-y border-brand-border bg-brand-card/40">
        <div className="shell grid grid-cols-1 gap-12 py-20 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-3">Chromatography on file</p>
            <h2 className="section-title">
              A catalogue you can check before you commit to it
            </h2>
            <div className="mt-6 space-y-4 text-[0.8125rem] leading-relaxed text-brand-body">
              <p>
                We keep lyophilized peptides and the consumables that go with them on hand for
                university groups, contract labs and independent researchers working in the United
                States. Nothing here is a therapeutic product &mdash; it is bench stock, and it is sold
                on that basis.
              </p>
              <p>
                Purity is a number we have to earn. An outside laboratory runs the chromatography, and
                whatever it reports goes up on the product page as-is. If a lot underperforms, the
                figure you see reflects that, because we would rather lose the sale than quietly round
                it up.
              </p>
            </div>

            <div className="mt-8">
              <Link href="/shop" className="btn-primary">
                Browse the catalogue
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <h3 className="font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
              What comes with every order
            </h3>
            <ul className="mt-5 divide-y divide-brand-border border-y border-brand-border">
              {[
                {
                  t: 'The chromatogram for your lot',
                  d: 'Identity and purity readings you can pull up and read, not a summary of them.',
                },
                {
                  t: 'An analyst with nothing to gain',
                  d: 'The lab doing the testing has no stake in whether the number flatters us.',
                },
                {
                  t: 'A standing offer to be checked',
                  d: 'Run your own assay. If ours overstated the lot, the order and your testing fee come back to you.',
                },
                {
                  t: 'Vials that survive the trip',
                  d: 'Sealed under inert gas, tracked in transit, and free to ship once the order clears $100.',
                },
                {
                  t: 'A support desk that stays in its lane',
                  d: 'Identity, contents, paperwork and shipping we will answer. How to run your experiment we will not.',
                },
              ].map((item) => (
                <li key={item.t} className="flex gap-3 py-4">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-accentGlow" />
                  <div>
                    <span className="block font-display text-xs font-extrabold text-brand-heading">
                      {item.t}
                    </span>
                    <span className="text-xs leading-relaxed text-brand-textMuted">{item.d}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5 - Most requested */}
      <section className="shell py-20">
        <SectionHead
          eyebrow="Reordered most often"
          title="Most-requested research peptides"
          href="/shop"
          linkLabel="Shop all peptides"
        />
        <p className="-mt-4 mb-8 max-w-3xl text-[0.8125rem] leading-relaxed text-brand-textMuted">
          These are the lines that empty out fastest &mdash; the repair and matrix peptides, the
          incretin series, the thymosins and the bioregulators. Same footing as everything else in the
          catalogue: lyophilized, sealed, and shipped with its chromatography on file.
        </p>
        <div className="rail">
          {mostRequested.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6 - Purity guarantee */}
      <section className="border-y border-brand-border bg-brand-card/40">
        <div className="shell grid grid-cols-1 gap-12 py-20 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow mb-3">Check our work</p>
            <h2 className="section-title">We pay for the test that proves us wrong</h2>
            <div className="mt-6 space-y-4 text-[0.8125rem] leading-relaxed text-brand-body">
              <p>
                A purity claim is worth very little if the only party who can verify it is the one
                making the sale. So take a vial you bought here to a laboratory of your choosing and
                have it run. If the assay lands below the figure we published for that lot, you get the
                price of the vial back and the cost of the assay along with it &mdash; see the
                eligibility terms for what qualifies.
              </p>
              <p>
                Shorter problems get shorter answers. Wrong item, cracked vial, or you cannot tell
                which report belongs to the vial on your bench &mdash; write in and we will sort it out.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/about-us" className="btn-primary">
                How we test
              </Link>
              <Link href="/faq" className="btn-ghost">
                Eligibility requirements
              </Link>
            </div>
          </div>

          {/* Sample analysis panel */}
          <div className="lg:col-span-5">
            <div className="border border-brand-border bg-brand-dark">
              <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading">
                  Sample analysis
                </span>
                <span className="bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] text-white">
                  Pass
                </span>
              </div>
              <dl className="divide-y divide-brand-border text-xs">
                {[
                  ['Compound', 'Retatrutide 10mg'],
                  ['Method', 'RP-HPLC, UV 214nm'],
                  ['Theoretical mass', '4731.33 Da'],
                  ['Observed mass', '4731.40 Da'],
                  ['Purity', '99.64%'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-5 py-3">
                    <dt className="text-brand-textMuted">{k}</dt>
                    <dd className="font-display font-bold text-brand-heading">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-brand-border px-5 py-3 text-[0.625rem] text-brand-textMuted">
                Representative result. The published test for each product is linked on its own page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7 - Categories */}
      <CategoryNav />

      {/* 8 - Calculator */}
      <section className="shell py-20">
        <ReconstitutionCalculator />
      </section>

      {/* 9 - Research articles */}
      <section className="shell py-20">
        <SectionHead
          eyebrow="Research &amp; protocols"
          title="From the laboratory notes"
          href="/blog"
          linkLabel="Read all articles"
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {articles.map((art) => (
            <Link
              key={art.id}
              href={`/blog/${art.slug}`}
              className="group flex flex-col border border-brand-border bg-brand-card transition-colors hover:border-brand-accent/60"
            >
              <div className="aspect-video overflow-hidden bg-brand-darker">
                <img
                  src={art.image}
                  alt={art.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.12em] text-brand-textMuted">
                  <span className="text-brand-accentGlow">{art.category}</span>
                  <span>&middot;</span>
                  <span>{art.readTime}</span>
                </div>
                <h3 className="mt-3 font-display text-[0.9375rem] font-extrabold leading-snug text-brand-heading transition-colors group-hover:text-brand-accentGlow">
                  {art.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-textMuted">{art.excerpt}</p>
                <div className="flex-1" />
                <span className="mt-5 inline-flex items-center gap-1.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow">
                  Read article
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 10 - Questions researchers ask */}
      <section className="border-t border-brand-border bg-brand-card/40">
        <div className="shell py-20">
          <SectionHead
            eyebrow="Before you order"
            title="What buyers usually want to know first"
            href="/faq"
            linkLabel="All questions"
          />
          <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
            {homeFaqs.map((faq) => (
              <div key={faq.question} className="border-t border-brand-border py-5">
                <h3 className="font-display text-[0.8125rem] font-extrabold text-brand-heading">
                  {faq.question}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-brand-textMuted">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
