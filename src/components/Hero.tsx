'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useSiteContent } from '@/components/SiteContentProvider';
import { contentLines, safeHref } from '@/lib/siteContent';

/**
 * Centered hero. No gradient, no glow, no ornament — the headline and the
 * hairline rules do the work, which is how the reference layout holds up.
 *
 * A muted looping video plays behind the headline on phones and tablets, and
 * in the right 60% on desktop, fading out towards the copy (see .hero-media).
 * The file name is versioned: browsers cache /videos/* hard, so a new clip
 * needs a new name or phones keep showing the old one. Visitors
 * who ask for reduced motion get the plain forest band instead.
 */
export default function Hero() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const { t } = useSiteContent();
  const titleLines = t('hero.title').split(/\n/);
  const primaryHref = safeHref(t('hero.primaryHref')) || '/shop';
  const secondaryHref = safeHref(t('hero.secondaryHref'));
  return (
    <section className="theme-forest relative isolate overflow-hidden border-b border-brand-border bg-brand-dark">
      {/* A looping video needs a way to stop it (WCAG 2.2.2). */}
      <button
        type="button"
        className="absolute bottom-3 right-4 z-20 border border-brand-border bg-brand-dark/80 px-3 py-2 text-xs text-brand-heading motion-reduce:hidden"
        onClick={() => {
          if (playing) video.current?.pause();
          else void video.current?.play().catch(() => setPlaying(false));
        }}
      >
        {playing ? 'Pause background' : 'Play background'}
      </button>
      <div className="shell pb-16 sm:pb-24 lg:py-32">
        <div className="mx-auto max-w-4xl text-center lg:mx-0 lg:max-w-[50%]">
          <div className="relative pb-20 pt-24 sm:pb-24 sm:pt-32 lg:static lg:p-0">
            <div className="hero-media" aria-hidden="true">
              <video
                className="h-full w-full object-cover motion-reduce:hidden"
                src="/videos/hero-molecules.mp4"
                poster="/videos/hero-molecules-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                ref={video}
              />
              <div className="absolute inset-0 bg-brand-dark/40 lg:bg-brand-dark/25" />
            </div>

            <p className="eyebrow text-brand-body lg:text-brand-textMuted">
              {t('hero.eyebrow')}
            </p>

            <h1 className="mt-6 font-display uppercase text-brand-heading text-hero lg:text-[clamp(2.5rem,3.6vw,4.25rem)]">
              {titleLines.map((line, i) => (
                <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
              ))}
            </h1>
          </div>

          <ul className="flex flex-col items-center justify-center divide-y divide-brand-border border-y border-brand-border sm:flex-row sm:divide-x sm:divide-y-0 lg:mt-9">
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
