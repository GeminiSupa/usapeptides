import { timingSafeEqual } from 'node:crypto';

import { cleanMultiline, cleanText, isEmail, isPhone, normaliseEmail } from './validate';

/**
 * Rules for a form posted into the CRM from this site or from another domain.
 * No database and no secret here, so the checks can be tested on their own.
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

export interface LeadIntakeFailure {
  ok: false;
  message: string;
  fields: Record<string, string>;
}

/** Constant-time compare that does not leak the secret's length through timing. */
export function secretMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
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

/**
 * Read a partner-site form. `site` is required so a lead always says which
 * domain it came from. Email or phone is required; a name alone cannot be followed up.
 */
export function parseLeadIntake(body: Record<string, unknown>): { ok: true; value: InboundLead } | LeadIntakeFailure {
  const fields: Record<string, string> = {};
  const site = siteHost(body.site ?? body.domain ?? body.website);
  if (!site) fields.site = 'Send the site domain, for example shop.example.com.';

  const emailRaw = normaliseEmail(body.email);
  const email = emailRaw && isEmail(emailRaw) ? emailRaw : '';
  if (body.email != null && String(body.email).trim() && !email) fields.email = 'Enter a valid email address, or leave it blank.';

  const phone = cleanText(body.phone, 50);
  if (phone && !isPhone(phone)) fields.phone = 'Enter a valid phone number, or leave it blank.';
  if (!email && !phone && !fields.email && !fields.phone) {
    fields.email = 'An email address or a phone number is required.';
  }

  const name = cleanText(body.name ?? body.full_name, 160);
  const institution = cleanText(body.institution ?? body.company, 200);
  const message = cleanMultiline(body.message ?? body.notes, 2000);

  if (Object.keys(fields).length) {
    return { ok: false, message: 'Lead rejected.', fields };
  }

  return {
    ok: true,
    value: {
      name: name.length >= 2 ? name : null,
      email: email || null,
      phone: phone || null,
      institution: institution || null,
      message: message || null,
      site: site!,
    },
  };
}
