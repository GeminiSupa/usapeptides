import React from 'react';
import Link from 'next/link';

/**
 * Building blocks for the writer's long-form pages (About, Our story, Why us,
 * How it works, Knowledge Center).
 *
 * Two rules shape these:
 *   - The owner rejected walls of text, so a page is built from short blocks
 *     with hairline borders — no gradients, glows or ornaments.
 *   - Detail lives behind a "read more" that is a native <details>. The text
 *     is in the HTML whether or not it is open, so search engines and screen
 *     readers still get the whole article, and no JavaScript is needed.
 */

export function PageHeader({
  eyebrow,
  title,
  lede,
  intro,
}: {
  eyebrow: string;
  title: string;
  /** One short line, set larger than the body copy. */
  lede?: string;
  intro?: string[];
}) {
  return (
    <header className="max-w-3xl border-b border-brand-border pb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      {lede && (
        <p className="mt-5 font-display text-base font-extrabold uppercase leading-tight tracking-[0.02em] text-brand-heading sm:text-lg">
          {lede}
        </p>
      )}
      {intro?.map((para, i) => (
        <p key={i} className="mt-4 text-sm leading-relaxed text-brand-body">
          {para}
        </p>
      ))}
    </header>
  );
}

/** A paragraph run at body size. */
export function Prose({ body, muted = false }: { body: string[]; muted?: boolean }) {
  return (
    <div className="max-w-[68ch] space-y-4">
      {body.map((para, i) => (
        <p
          key={i}
          className={`text-sm leading-relaxed ${muted ? 'text-brand-textMuted' : 'text-brand-body'}`}
        >
          {para}
        </p>
      ))}
    </div>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="max-w-[68ch] space-y-2.5 border-l border-brand-border pl-5">
      {items.map((item) => (
        <li key={item} className="text-sm leading-relaxed text-brand-body">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Read more. Closed by default; the body stays in the HTML either way. */
export function Disclosure({
  summary,
  kicker,
  openLabel = 'Read more',
  defaultOpen = false,
  children,
}: {
  summary: string;
  kicker?: string;
  openLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border border-brand-border bg-brand-card">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          {kicker && <span className="eyebrow mb-2 block text-brand-accentGlow">{kicker}</span>}
          <span className="block font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
            {summary}
          </span>
        </span>
        <span className="mt-0.5 flex-shrink-0 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow">
          <span className="group-open:hidden">{openLabel}</span>
          <span className="hidden group-open:inline">Close</span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-brand-border px-5 pb-6 pt-5">{children}</div>
    </details>
  );
}

/** Numbered step. The summary line is always visible; detail is behind it. */
export function Step({
  number,
  title,
  summary,
  detail,
}: {
  number: number;
  title: string;
  summary: string;
  detail?: string[];
}) {
  return (
    <article className="border border-brand-border bg-brand-card">
      <div className="flex gap-4 p-5">
        <span className="font-display text-lg font-extrabold leading-none text-brand-accentGlow">
          {String(number).padStart(2, '0')}
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-heading">
            {title}
          </h2>
          <p className="max-w-[68ch] text-sm leading-relaxed text-brand-body">{summary}</p>
        </div>
      </div>
      {detail && detail.length > 0 && (
        <details className="group border-t border-brand-border">
          <summary className="cursor-pointer list-none px-5 py-3 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Read more</span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          <div className="px-5 pb-5">
            <Prose body={detail} muted />
          </div>
        </details>
      )}
    </article>
  );
}

/** The line the owner keeps coming back to: "Trust. Verified." */
export function StatementCard({ quote, tagline }: { quote: string; tagline?: string }) {
  return (
    <div className="border border-brand-border bg-brand-card p-6">
      <p className="font-display text-xl font-extrabold uppercase leading-tight text-brand-heading">
        {quote}
      </p>
      {tagline && <p className="mt-4 text-sm text-brand-textMuted">{tagline}</p>}
    </div>
  );
}

export function Related({ links }: { links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Link key={link.href + link.label} href={link.href} className="btn-ghost">
          {link.label}
        </Link>
      ))}
    </div>
  );
}

/** The research-use-only line every one of these pages ends with. */
export function ResearchUseNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-t border-brand-border pt-6">
      <p className="max-w-[80ch] text-xs leading-relaxed text-brand-textMuted">
        {children ??
          'Products are intended for laboratory and research use only and are not intended for human or veterinary use.'}
      </p>
    </div>
  );
}
