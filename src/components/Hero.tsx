'use client';

import React from 'react';
import Link from 'next/link';
import { useSiteContent } from '@/components/SiteContentProvider';
import { contentLines, safeHref } from '@/lib/siteContent';

/**
 * Centered hero. No gradient, no glow, no ornament — the headline and the
 * hairline rules do the work, which is how the reference layout holds up.
 *
 * A muted looping video sits above the copy on phones and tablets, and in the
 * right 60% on desktop, fading out towards the copy (see .hero-media). Visitors
 * who ask for reduced motion get the plain forest band instead.
 */
export default function Hero() {
  const { t } = useSiteContent();
  const titleLines = t('hero.title').split(/\n/);
  const primaryHref = safeHref(t('hero.primaryHref')) || '/shop';
  const secondaryHref = safeHref(t('hero.secondaryHref'));
  return (
    <section className="theme-forest relative isolate overflow-hidden border-b border-brand-border bg-brand-dark">
      <div className="hero-media" aria-hidden="true">
        <video
          className="h-full w-full object-cover motion-reduce:hidden"
          src="/videos/hero-bg.mp4"
          poster="/videos/hero-bg-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="absolute inset-0 bg-brand-dark/25" />
      </div>
      <div className="shell relative -mt-6 pb-16 sm:-mt-10 sm:pb-24 lg:mt-0 lg:py-32">
        <div className="mx-auto max-w-4xl text-center lg:mx-0 lg:max-w-[50%]">
          <p className="eyebrow text-brand-textMuted">
            {t('hero.eyebrow')}
          </p>

          <h1 className="mt-6 font-display uppercase text-brand-heading text-hero lg:text-[clamp(2.5rem,3.6vw,4.25rem)]">
            {titleLines.map((line, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
            ))}
          </h1>

          <ul className="mt-9 flex flex-col items-center justify-center divide-y divide-brand-border border-y border-brand-border sm:flex-row sm:divide-x sm:divide-y-0">
            {contentLines(t('hero.points')).map((item) => (
              <li
                key={item}
                className="w-full px-6 py-4 text-[0.8125rem] font-medium text-brand-body sm:w-auto"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={primaryHref} className="btn-primary w-full sm:w-auto">
              {t('hero.primaryLabel')}
            </Link>
            {secondaryHref && t('hero.secondaryLabel') && (
              <Link href={secondaryHref} className="btn-ghost w-full sm:w-auto">
                {t('hero.secondaryLabel')}
              </Link>
            )}
          </div>

          <p className="mx-auto mt-12 max-w-3xl text-xs leading-relaxed text-brand-textMuted">
            {t('hero.disclaimer')}
          </p>
        </div>
      </div>
    </section>
  );
}
