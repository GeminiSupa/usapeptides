'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSiteContent } from '@/components/SiteContentProvider';
import { contentLines, safeHref } from '@/lib/siteContent';

/**
 * Centered hero. No gradient, no glow, no ornament — the headline and the
 * hairline rules do the work, which is how the reference layout holds up.
 */
export default function Hero() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => setPlaying(false));
    };
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const { t } = useSiteContent();
  const titleLines = t('hero.title').split(/\n/);
  const primaryHref = safeHref(t('hero.primaryHref')) || '/shop';
  const secondaryHref = safeHref(t('hero.secondaryHref'));
  return (
    <section className="theme-forest relative isolate overflow-hidden border-b border-brand-border bg-brand-dark">
      <video ref={video} muted loop playsInline preload="metadata"
        poster="/videos/biotech-poster.jpg" aria-hidden="true"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover">
        <source src="/videos/biotech-hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-[1] bg-brand-dark/40" aria-hidden="true" />
      <button type="button" className="absolute bottom-3 right-4 z-20 border border-brand-border bg-brand-dark/80 px-3 py-2 text-xs text-brand-heading"
        onClick={() => { if (playing) video.current?.pause(); else void video.current?.play().catch(() => setPlaying(false)); }}>
        {playing ? 'Pause background' : 'Play background'}
      </button>
      <div className="shell relative z-10 py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow text-brand-textMuted">
            {t('hero.eyebrow')}
          </p>

          <h1 className="mt-6 font-display uppercase text-brand-heading text-hero">
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
