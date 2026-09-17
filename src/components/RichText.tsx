import React from 'react';

/**
 * Renders the simple formatting the blog editor offers:
 *
 *   ## Heading        ### Smaller heading
 *   - bullet          1. numbered
 *   **bold**  *italic*  [link](https://…)  ![picture](https://…)
 *   > quote           blank line = new paragraph
 *
 * Built as React elements, never as HTML, so nothing typed into a post can run
 * script on the page. Links are limited to http(s), mailto, tel and site paths.
 */

const safeUrl = (url: string) => {
  const u = url.trim();
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : '';
};

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(!?\[([^\]]*)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) {
      const url = safeUrl(m[3]);
      if (!url) out.push(m[2]);
      else if (m[1].startsWith('!')) {
        // eslint-disable-next-line @next/next/no-img-element
        out.push(<img key={key} src={url} alt={m[2]} loading="lazy" className="my-4 w-full border border-brand-border" />);
      } else {
        const external = /^https?:/i.test(url);
        out.push(
          <a key={key} href={url} className="font-semibold text-brand-accentGlow underline underline-offset-2"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[2]}</a>
        );
      }
    } else if (m[4]) out.push(<strong key={key} className="text-brand-heading">{m[5]}</strong>);
    else if (m[6]) out.push(<em key={key}>{m[7]}</em>);
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i += 1; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls = level <= 2
        ? 'mt-8 font-display text-lg font-extrabold uppercase tracking-[0.04em] text-brand-heading'
        : 'mt-6 font-display text-base font-extrabold text-brand-heading';
      blocks.push(level <= 2
        ? <h2 key={k++} className={cls}>{inline(heading[2], `h${k}`)}</h2>
        : <h3 key={k++} className={cls}>{inline(heading[2], `h${k}`)}</h3>);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      const ordered = /^\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/).test(lines[i].trim())) {
        items.push(lines[i].trim().replace(ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/, ''));
        i += 1;
      }
      const children = items.map((item, n) => <li key={n}>{inline(item, `l${k}-${n}`)}</li>);
      blocks.push(ordered
        ? <ol key={k++} className="list-decimal space-y-1.5 pl-5">{children}</ol>
        : <ul key={k++} className="list-disc space-y-1.5 pl-5">{children}</ul>);
      continue;
    }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
      blocks.push(<blockquote key={k++} className="border-l-2 border-brand-accent pl-4 italic">{inline(quote.join(' '), `q${k}`)}</blockquote>);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+[.)]\s|>)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length === 0) { para.push(line); i += 1; } // never loop on a line nothing claimed
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
  }

  return <div className={`space-y-4 ${className}`}>{blocks}</div>;
}
