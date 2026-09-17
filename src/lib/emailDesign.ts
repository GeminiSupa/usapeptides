/**
 * Campaign emails: the blocks the builder offers, starter templates, and the
 * one function that turns a design into email HTML.
 *
 * The same renderer draws the dashboard preview and the email that is sent, so
 * what the owner approves is what customers get. Email clients ignore most
 * modern CSS, so the output is old-fashioned on purpose: tables, inline styles,
 * 600px wide. Every piece of text is escaped; the only formatting allowed is
 * **bold**, *italic* and [links](https://…).
 *
 * Shared by browser and server; imports nothing server-only.
 */

export type BlockType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'products' | 'quote';
export type Align = 'left' | 'center';

export interface ProductItem { name: string; price: string; image: string; href: string }

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  size?: 'lg' | 'md';
  align?: Align;
  src?: string;
  alt?: string;
  href?: string;
  label?: string;
  style?: 'action' | 'brand' | 'outline';
  height?: number;
  items?: ProductItem[];
}

export interface EmailDesign {
  blocks: Block[];
  /** Page colour behind the white card. */
  background?: string;
  /** Headline and brand-button colour. */
  accent?: string;
  logo?: string;
}

export interface RenderOptions {
  businessName: string;
  siteUrl: string;
  address?: string;
  previewText?: string;
  /** Replaced per recipient; the preview uses sample values. */
  unsubscribeUrl?: string;
  /** Extra HTML at the end of the body, e.g. the open-tracking pixel. */
  trailer?: string;
}

export const BRAND = { forest: '#1F4233', cream: '#FDFBF0', navy: '#233049', action: '#BF4F0B' };

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Picture',
  button: 'Button',
  products: 'Products',
  quote: 'Highlight box',
  divider: 'Line',
  spacer: 'Space',
};

let counter = 0;
export const blockId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newBlock(type: BlockType): Block {
  const id = blockId();
  switch (type) {
    case 'heading': return { id, type, text: 'Your headline', size: 'lg', align: 'center' };
    case 'text': return { id, type, text: 'Hi {first_name},\n\nWrite your message here. Use **bold** and [links](https://example.com).', align: 'left' };
    case 'image': return { id, type, src: '', alt: '', href: '' };
    case 'button': return { id, type, label: 'Shop now', href: '/shop', style: 'action', align: 'center' };
    case 'products': return { id, type, items: [] };
    case 'quote': return { id, type, text: 'A short highlight — an offer, a code, or a key fact.', align: 'center' };
    case 'divider': return { id, type };
    case 'spacer': return { id, type, height: 24 };
  }
}

/* ------------------------------------------------------------ templates -- */

export interface EmailTemplate { id: string; name: string; description: string; subject: string; preview: string; design: () => EmailDesign }

const t = (blocks: Omit<Block, 'id'>[]): EmailDesign => ({
  background: '#F3F1E6',
  accent: BRAND.forest,
  blocks: blocks.map((b) => ({ ...b, id: blockId() })) as Block[],
});

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from nothing.',
    subject: '',
    preview: '',
    design: () => t([{ type: 'text', text: 'Hi {first_name},\n\n', align: 'left' }]),
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description: 'One message, one button.',
    subject: 'News from {business}',
    preview: 'Something new for your lab',
    design: () => t([
      { type: 'heading', text: 'Something new for your lab', size: 'lg', align: 'center' },
      { type: 'text', text: 'Hi {first_name},\n\nWe have news we think you will want to see. Tell your readers what changed and why it matters to them.', align: 'left' },
      { type: 'button', label: 'See what is new', href: '/shop', style: 'action', align: 'center' },
      { type: 'divider' },
      { type: 'text', text: 'Questions? Just reply to this email.', align: 'center' },
    ]),
  },
  {
    id: 'products',
    name: 'Product spotlight',
    description: 'Show off a few products.',
    subject: 'Back in stock: our most requested compounds',
    preview: 'HPLC-tested, shipped from the US',
    design: () => t([
      { type: 'heading', text: 'Back in stock', size: 'lg', align: 'center' },
      { type: 'text', text: 'Hi {first_name}, the compounds researchers ask us about most are available again — each lot with its own certificate of analysis.', align: 'center' },
      { type: 'products', items: [] },
      { type: 'button', label: 'Browse the full catalogue', href: '/shop', style: 'brand', align: 'center' },
    ]),
  },
  {
    id: 'offer',
    name: 'Offer / discount',
    description: 'A code and a deadline.',
    subject: 'A thank-you from {business}',
    preview: 'Your code is inside',
    design: () => t([
      { type: 'heading', text: 'A thank-you for your lab', size: 'lg', align: 'center' },
      { type: 'text', text: 'Hi {first_name},\n\nFor the next seven days, use the code below at checkout.', align: 'center' },
      { type: 'quote', text: '**CODE: THANKYOU10** — 10% off orders over $100', align: 'center' },
      { type: 'button', label: 'Use my code', href: '/shop', style: 'action', align: 'center' },
      { type: 'text', text: 'Offer ends in seven days. One use per customer.', align: 'center' },
    ]),
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'Picture, article, links.',
    subject: 'This month in the lab',
    preview: 'Protocols, test results and new arrivals',
    design: () => t([
      { type: 'image', src: '', alt: 'Header picture', href: '' },
      { type: 'heading', text: 'This month in the lab', size: 'lg', align: 'left' },
      { type: 'text', text: 'Hi {first_name},\n\nA short introduction to this issue.', align: 'left' },
      { type: 'heading', text: 'From the research library', size: 'md', align: 'left' },
      { type: 'text', text: 'Summarise a blog post in two sentences. [Read the full article](/blog)', align: 'left' },
      { type: 'divider' },
      { type: 'heading', text: 'New arrivals', size: 'md', align: 'left' },
      { type: 'products', items: [] },
    ]),
  },
];

/* ------------------------------------------------------------ rendering -- */

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Absolute http(s) URL, or '' for anything unsafe. Site paths are made absolute. */
export function safeEmailUrl(url: unknown, siteUrl: string): string {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (u.startsWith('/') && !u.startsWith('//')) return `${siteUrl.replace(/\/+$/, '')}${u}`;
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  return '';
}

const hexOr = (v: unknown, fallback: string) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v) : fallback);

/** Escape, then allow **bold**, *italic*, [text](url) and line breaks. */
function inline(text: string, siteUrl: string, linkColor: string): string {
  let out = esc(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
    const url = safeEmailUrl(href.replace(/&amp;/g, '&'), siteUrl);
    return url ? `<a href="${esc(url)}" style="color:${linkColor};text-decoration:underline;">${label}</a>` : label;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out.replace(/\n/g, '<br>');
}

const FONT = "font-family:Arial,Helvetica,sans-serif;";

function renderBlock(b: Block, o: RenderOptions, accent: string): string {
  const align = b.align === 'center' ? 'center' : 'left';
  const pad = 'padding:10px 32px;';
  switch (b.type) {
    case 'heading': {
      const size = b.size === 'md' ? 20 : 28;
      return `<tr><td style="${pad}text-align:${align};"><h${b.size === 'md' ? 2 : 1} style="margin:8px 0;${FONT}font-size:${size}px;line-height:1.2;font-weight:800;color:${accent};">${inline(b.text ?? '', o.siteUrl, accent)}</h${b.size === 'md' ? 2 : 1}></td></tr>`;
    }
    case 'text':
      return `<tr><td style="${pad}text-align:${align};${FONT}font-size:16px;line-height:1.6;color:#1f2937;">${inline(b.text ?? '', o.siteUrl, accent)}</td></tr>`;
    case 'quote':
      return `<tr><td style="padding:12px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${BRAND.cream};border-left:4px solid ${accent};padding:16px 20px;text-align:${align};${FONT}font-size:17px;line-height:1.5;color:#111827;">${inline(b.text ?? '', o.siteUrl, accent)}</td></tr></table></td></tr>`;
    case 'image': {
      const src = safeEmailUrl(b.src, o.siteUrl);
      if (!src) return '';
      const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;">`;
      const href = safeEmailUrl(b.href, o.siteUrl);
      return `<tr><td style="padding:10px 32px;">${href ? `<a href="${esc(href)}">${img}</a>` : img}</td></tr>`;
    }
    case 'button': {
      const href = safeEmailUrl(b.href, o.siteUrl);
      if (!href || !b.label) return '';
      const bg = b.style === 'brand' ? accent : b.style === 'outline' ? '#ffffff' : BRAND.action;
      const fg = b.style === 'outline' ? accent : '#ffffff';
      const border = b.style === 'outline' ? `2px solid ${accent}` : `2px solid ${bg}`;
      return `<tr><td style="padding:16px 32px;" align="${b.align === 'left' ? 'left' : 'center'}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${bg};border:${border};border-radius:2px;"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;${FONT}font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${fg};text-decoration:none;">${esc(b.label)}</a></td></tr></table></td></tr>`;
    }
    case 'divider':
      return `<tr><td style="padding:16px 32px;"><div style="border-top:1px solid #e5e2d3;line-height:0;font-size:0;">&nbsp;</div></td></tr>`;
    case 'spacer':
      return `<tr><td style="height:${Math.max(4, Math.min(120, Number(b.height) || 24))}px;line-height:0;font-size:0;">&nbsp;</td></tr>`;
    case 'products': {
      const items = (b.items ?? []).slice(0, 6);
      if (!items.length) return '';
      const cells = items.map((p) => {
        const href = safeEmailUrl(p.href, o.siteUrl);
        const img = safeEmailUrl(p.image, o.siteUrl);
        return `<td width="50%" valign="top" style="padding:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e2d3;"><tr><td style="padding:12px;text-align:center;">${
          img ? `<a href="${esc(href)}"><img src="${esc(img)}" alt="${esc(p.name)}" width="200" style="display:block;margin:0 auto;width:100%;max-width:200px;height:auto;border:0;"></a>` : ''
        }<p style="margin:10px 0 4px;${FONT}font-size:14px;font-weight:700;color:#111827;">${esc(p.name)}</p><p style="margin:0 0 10px;${FONT}font-size:14px;color:#374151;">${esc(p.price)}</p>${
          href ? `<a href="${esc(href)}" style="${FONT}font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${BRAND.action};text-decoration:none;">View product</a>` : ''
        }</td></tr></table></td>`;
      });
      const rows: string[] = [];
      for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
      return `<tr><td style="padding:8px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table></td></tr>`;
    }
    default:
      return '';
  }
}

export function renderEmailHtml(design: EmailDesign, subject: string, o: RenderOptions): string {
  const accent = hexOr(design.accent, BRAND.forest);
  const background = hexOr(design.background, '#F3F1E6');
  const logo = safeEmailUrl(design.logo || '/logo.png', o.siteUrl);
  const body = (design.blocks ?? []).map((b) => renderBlock(b, o, accent)).join('');
  const unsubscribe = o.unsubscribeUrl
    ? `<a href="${esc(o.unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>`
    : 'Unsubscribe';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.previewText ?? '')}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
<tr><td style="background:${BRAND.forest};padding:18px 32px;" align="left"><a href="${esc(o.siteUrl)}"><img src="${esc(logo)}" alt="${esc(o.businessName)}" height="40" style="display:block;height:40px;width:auto;border:0;"></a></td></tr>
<tr><td style="height:12px;line-height:0;font-size:0;">&nbsp;</td></tr>
${body}
<tr><td style="height:24px;line-height:0;font-size:0;">&nbsp;</td></tr>
<tr><td style="background:${BRAND.navy};padding:20px 32px;${FONT}font-size:12px;line-height:1.6;color:#d1d5db;text-align:center;">
<strong style="color:#ffffff;">${esc(o.businessName)}</strong><br>${o.address ? `${esc(o.address)}<br>` : ''}
You are receiving this because you signed up, ordered, or asked us about our products.<br>
<a href="${esc(o.siteUrl)}" style="color:#d1d5db;">${esc(o.siteUrl.replace(/^https?:\/\//, ''))}</a> · ${unsubscribe.replace('#6b7280', '#d1d5db')}<br>
<span style="color:#9ca3af;">All products are for in-vitro laboratory research use only.</span>
</td></tr>
</table></td></tr></table>
${o.trailer ?? ''}
</body></html>`;
}

/** Plain-text version for clients that do not show HTML. */
export function renderEmailText(design: EmailDesign, o: RenderOptions): string {
  const lines: string[] = [];
  for (const b of design.blocks ?? []) {
    if (b.type === 'heading' || b.type === 'text' || b.type === 'quote') {
      lines.push(String(b.text ?? '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, l, h) => `${l} (${safeEmailUrl(h, o.siteUrl)})`));
    } else if (b.type === 'button' && b.label) {
      lines.push(`${b.label}: ${safeEmailUrl(b.href, o.siteUrl)}`);
    } else if (b.type === 'products') {
      for (const p of b.items ?? []) lines.push(`- ${p.name} ${p.price} ${safeEmailUrl(p.href, o.siteUrl)}`);
    } else if (b.type === 'divider') {
      lines.push('----');
    }
    lines.push('');
  }
  lines.push('--', o.businessName);
  if (o.address) lines.push(o.address);
  if (o.unsubscribeUrl) lines.push(`Unsubscribe: ${o.unsubscribeUrl}`);
  return lines.join('\n');
}

/** Merge fields: {first_name}, {name}, {email}, {business}. */
export function personalize(text: string, r: { name?: string | null; email?: string | null }, businessName: string): string {
  const name = String(r.name ?? '').trim();
  const first = name.split(/\s+/)[0] || 'there';
  return text
    .replace(/\{first_name\}/g, first)
    .replace(/\{name\}/g, name || 'there')
    .replace(/\{email\}/g, String(r.email ?? ''))
    .replace(/\{business\}/g, businessName);
}

/** Clean a posted design: known block types and fields only, sensible lengths. */
export function sanitizeDesign(input: unknown): EmailDesign {
  const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const blocks = (Array.isArray(d.blocks) ? d.blocks : []).slice(0, 60).map((raw): Block | null => {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const type = String(b.type) as BlockType;
    if (!(type in BLOCK_LABELS)) return null;
    const s = (v: unknown, max: number) => String(v ?? '').slice(0, max);
    return {
      id: s(b.id, 40) || blockId(),
      type,
      text: b.text !== undefined ? s(b.text, 10000) : undefined,
      size: b.size === 'md' ? 'md' : 'lg',
      align: b.align === 'center' ? 'center' : 'left',
      src: b.src !== undefined ? s(b.src, 1000) : undefined,
      alt: b.alt !== undefined ? s(b.alt, 300) : undefined,
      href: b.href !== undefined ? s(b.href, 1000) : undefined,
      label: b.label !== undefined ? s(b.label, 80) : undefined,
      style: b.style === 'brand' || b.style === 'outline' ? b.style : 'action',
      height: Number(b.height) || undefined,
      items: Array.isArray(b.items)
        ? b.items.slice(0, 6).map((i) => {
          const it = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
          return { name: s(it.name, 160), price: s(it.price, 40), image: s(it.image, 1000), href: s(it.href, 1000) };
        })
        : undefined,
    };
  }).filter((b): b is Block => Boolean(b));
  return {
    blocks,
    background: hexOr(d.background, '#F3F1E6'),
    accent: hexOr(d.accent, BRAND.forest),
    logo: typeof d.logo === 'string' ? d.logo.slice(0, 1000) : undefined,
  };
}

/* ------------------------------------------------------------ audiences -- */

export const AUDIENCES = [
  { id: 'subscribers', label: 'Newsletter subscribers', hint: 'Signed up on the website' },
  { id: 'customers', label: 'Customers who opted in', hint: 'Ordered and ticked "email me"' },
  { id: 'all_customers', label: 'All customers', hint: 'Everyone who has ordered — use for order-related news' },
  { id: 'leads', label: 'Leads', hint: 'Enquiries and CRM leads with an email' },
  { id: 'everyone', label: 'Everyone', hint: 'All of the above, each address once' },
] as const;

export const AUDIENCE_FILTERS = [
  { id: 'none', label: 'Everyone in the group' },
  { id: 'engaged', label: 'Opened or clicked in the last 90 days' },
  { id: 'dormant', label: 'No opens in 180 days (win-back)' },
  { id: 'buyers', label: 'Has ordered before' },
  { id: 'non_buyers', label: 'Never ordered' },
] as const;

export type AudienceId = (typeof AUDIENCES)[number]['id'];
export type AudienceFilterId = (typeof AUDIENCE_FILTERS)[number]['id'];

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  paused: 'Paused',
  sent: 'Sent',
  cancelled: 'Cancelled',
};
