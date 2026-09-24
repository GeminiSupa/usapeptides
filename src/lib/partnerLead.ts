import { cleanText } from './validate';

/**
 * The shape every inbound form shares, and how a domain is normalised.
 *
 * Both paths into Leads use this: the storefront's own contact form
 * (`/api/contact`) and the lead-gen sites' endpoint (`/api/leads/intake`).
 * Keeping it out of either of those files means neither has to import the
 * other's rules, and `siteHost` can be tested on its own.
 */

export interface InboundLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  institution: string | null;
  message: string | null;
  /** Hostname only, lower case. This is what Leads shows as the source. */
  site: string;
}

/** `https://Shop.Example.com/contact` and `shop.example.com` both become the host. */
export function siteHost(value: unknown): string | null {
  const raw = cleanText(value, 200);
  if (!raw || /\s/.test(raw)) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(withScheme).hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || host.length > 120) return null;
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
    return host;
  } catch {
    return null;
  }
}
