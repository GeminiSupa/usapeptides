'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useSiteContent } from '@/components/SiteContentProvider';
import { safeHref } from '@/lib/siteContent';
import { isEmail } from '@/lib/validate';

const SOCIAL: [string, string][] = [
  ['social.instagram', 'Instagram'], ['social.facebook', 'Facebook'], ['social.x', 'X'],
  ['social.youtube', 'YouTube'], ['social.tiktok', 'TikTok'], ['social.linkedin', 'LinkedIn'],
];

/** Newsletter sign-up. This form used to discard the address it collected. */
function NewsletterSignup({ title }: { title: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) { setError('Enter a valid email address.'); return; }
    setError(''); setState('sending');
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), source: 'footer' }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const payload = res ? await res.json().catch(() => null) : null;
      setState('idle');
      setError((payload as { message?: string } | null)?.message ?? 'Could not subscribe. Please try again.');
      return;
    }
    setState('done'); setEmail('');
  };

  return (
    <div>
      <div className="eyebrow mb-3 text-brand-textMuted">{title}</div>
      {state === 'done' ? (
        <p className="max-w-sm text-xs text-brand-accentGlow" role="status">
          Thank you — this address is on the list.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex max-w-sm">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            aria-label={title}
            aria-invalid={Boolean(error)}
            autoComplete="email"
            placeholder="name@institution.edu"
            className="min-w-0 flex-grow border border-brand-border bg-brand-card px-3 py-2.5 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="flex flex-shrink-0 items-center gap-1 bg-brand-accent px-4 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover disabled:opacity-60"
          >
            <span>{state === 'sending' ? 'Joining' : 'Join'}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </form>
      )}
      {error && <p className="mt-2 max-w-sm border border-action/50 p-2 text-xs text-brand-body" role="alert">{error}</p>}
    </div>
  );
}

export default function Footer() {
  const categories = useCategories();
  const { t } = useSiteContent();
  const name = t('business.name');
  const phone = t('contact.phone');
  const socials = SOCIAL.map(([key, label]) => ({ label, href: safeHref(t(key)) })).filter((s) => s.href);
  return (
    <footer className="theme-navy mt-24 border-t border-brand-border bg-brand-dark text-brand-body">
      <div className="shell grid grid-cols-1 gap-10 py-16 md:grid-cols-2 lg:grid-cols-5">
        {/* Brand + newsletter */}
        <div className="space-y-5 lg:col-span-2">
          <Link href="/" className="inline-block" aria-label={`${name} home`}>
            <Image
              src="/logo.png"
              alt={name}
              width={622}
              height={205}
              className="h-14 w-auto"
            />
          </Link>

          <p className="max-w-sm text-xs leading-relaxed text-brand-textMuted">
            {t('footer.about')}
          </p>

          <NewsletterSignup title={t('footer.newsletterTitle')} />
        </div>

        {/* Categories */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Categories</h4>
          <ul className="space-y-0.5 text-xs sm:space-y-2.5">
            {categories.slice(0, 6).map((cat) => (
              <li key={cat.id}>
                <Link href={`/category/${cat.slug}`} className="inline-block py-1.5 transition-colors hover:text-brand-accentGlow sm:py-0">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Navigation</h4>
          <ul className="space-y-0.5 text-xs sm:space-y-2.5">
            {[
              { href: '/shop', label: 'All research peptides' },
              { href: '/install', label: 'Mobile app' },
              { href: '/coa-database', label: 'COA database' },
              { href: '/bulk-discounts', label: 'Bulk discounts' },
              { href: '/calculator', label: 'Reconstitution calculator' },
              { href: '/order-received', label: 'Track an order' },
              { href: '/blog', label: 'Research & test results' },
              { href: '/about-us', label: 'About our standards' },
              { href: '/our-story', label: 'Our story' },
              { href: '/our-team', label: 'Our team and leadership' },
              { href: '/knowledge-center', label: 'Knowledge Center' },
              { href: '/why-us', label: 'Why us' },
              { href: '/how-it-works', label: 'How it works' },
              { href: '/quality-standards', label: 'Quality standards' },
              { href: '/faq', label: 'Frequently asked questions' },
              { href: '/contact-us', label: 'Contact support' },
              { href: '/affiliates', label: 'Affiliate portal' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-block py-1.5 transition-colors hover:text-brand-accentGlow sm:py-0">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Support</h4>
          <div className="space-y-3.5 text-xs text-brand-textMuted">
            <p>
              <span className="block text-brand-textMuted/70">Orders &amp; enquiries</span>
              <a href={`mailto:${t('contact.email')}`} className="text-brand-accentGlow hover:underline">
                {t('contact.email')}
              </a>
            </p>
            {phone && (
              <p>
                <span className="block text-brand-textMuted/70">Phone</span>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-brand-accentGlow hover:underline">{phone}</a>
              </p>
            )}
            <p>
              <span className="block text-brand-textMuted/70">Ships from</span>
              <span className="text-brand-body">{t('contact.shipsFrom')}</span>
            </p>
            <p>
              <span className="block text-brand-textMuted/70">Hours</span>
              <span className="text-brand-body">{t('contact.hours')}</span>
            </p>
            {socials.length > 0 && (
              <p className="flex flex-wrap gap-x-3 gap-y-1">
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="text-brand-accentGlow hover:underline">{s.label}</a>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Regulatory disclaimer */}
      <div className="border-t border-brand-border bg-brand-card/40">
        <div className="shell space-y-5 py-8">
          <div className="border border-brand-border bg-brand-card p-5">
            <p className="eyebrow mb-2 text-brand-accentGlow">{t('footer.complianceTitle')}</p>
            <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
              {t('footer.compliance')}
            </p>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-[0.6875rem] text-brand-textMuted sm:flex-row">
            <p>&copy; {new Date().getFullYear()} {t('footer.copyright')}</p>
            <div className="flex flex-wrap items-center justify-center gap-5">
              {[
                { href: '/privacy-policy', label: 'Privacy policy' },
                { href: '/shipping-policy', label: 'Shipping policy' },
                { href: '/return-refund-policy', label: 'Returns & refunds' },
                { href: '/unsubscribe', label: 'Unsubscribe' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-block py-2 transition-colors hover:text-brand-accentGlow sm:py-0"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
