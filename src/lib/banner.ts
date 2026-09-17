/**
 * Announcement banner shared between the dashboard editor and the storefront.
 *
 * Banners live in `site_settings` under the id 'announcement_banners' as a JSON
 * array. The storefront reads that row with the anon key; only the admin API
 * writes it.
 */

export interface Banner {
  id: string;
  text: string;
  /** Optional destination. Anything that is not a safe link is dropped. */
  href?: string;
  isActive: boolean;
  /** Scheduled deal banners disappear at this instant, even on an open page. */
  expiresAt?: string;
}

/** Where the bar is allowed to send a visitor. */
export function sanitizeBannerHref(href: string | undefined | null): string {
  const value = String(href ?? '').trim();
  if (!value) return '';
  const safe =
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:');
  return safe ? value : '';
}

/**
 * Banner copy is typed into a form by staff, then rendered as text - never as
 * HTML - so markup cannot reach the page. This only tidies whitespace and
 * caps the length so one long paste cannot push the bar off the screen.
 */
export function cleanBannerText(text: string | undefined | null): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

export function normalizeBanner(raw: unknown, index: number): Banner | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const text = cleanBannerText(b.text as string);
  if (!text) return null;
  return {
    id: typeof b.id === 'string' && b.id ? b.id : `banner-${index}`,
    text,
    href: sanitizeBannerHref(b.href as string) || undefined,
    isActive: b.isActive !== false,
    expiresAt: typeof b.endsAt === 'string' ? b.endsAt : typeof b.expiresAt === 'string' ? b.expiresAt : undefined,
  };
}

export function normalizeBanners(value: unknown): Banner[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeBanner).filter((b): b is Banner => b !== null).slice(0, 12);
}

export const activeBanners = (banners: Banner[]): Banner[] => banners.filter((b) =>
  b.isActive && (!b.expiresAt || new Date(b.expiresAt).getTime() > Date.now())
);
