import { cleanMultiline, cleanText, isEmail, isPersonName, isPhone, normaliseEmail } from './validate';

/**
 * Lead intake for the local lead-gen sites.
 *
 * The dropdown options, the payload rules and the spam checks live here so the
 * public endpoint and the dashboard agree on what a lead looks like. Nothing
 * in this file names a business: the option lists are generic peptide-industry
 * interests and the site list lives in the database, so another deployment of
 * this template changes no code.
 *
 * The spec the lead-gen sites are built against is docs/LEAD-INTAKE-API.md.
 */

export interface Choice {
  slug: string;
  label: string;
}

export const INTEREST_OPTIONS: Choice[] = [
  { slug: 'weight_management', label: 'Weight management' },
  { slug: 'hair_scalp', label: 'Hair & scalp' },
  { slug: 'skin_cosmetic', label: 'Skin / cosmetic' },
  { slug: 'collagen', label: 'Collagen' },
  { slug: 'copper_peptides', label: 'Copper peptides' },
  { slug: 'general_info', label: 'General peptide information' },
  { slug: 'availability', label: 'Product availability' },
  { slug: 'pricing', label: 'Pricing' },
  { slug: 'other', label: 'Other' },
];

export const GOAL_OPTIONS: Choice[] = [
  { slug: 'weight_management', label: 'Weight management' },
  { slug: 'body_composition', label: 'Body composition' },
  { slug: 'recovery', label: 'Recovery' },
  { slug: 'healthy_aging', label: 'Healthy aging' },
  { slug: 'skin_appearance', label: 'Skin appearance' },
  { slug: 'hair', label: 'Hair' },
  { slug: 'general_wellness', label: 'General wellness' },
  { slug: 'learning_options', label: 'Learning about peptide options' },
  { slug: 'other', label: 'Other' },
];

/** The value stored in `leads.source` for everything the intake endpoint takes. */
export const LOCAL_LEAD_SOURCE = 'local_site';

/** A lead that arrived less than this long ago is updated, not duplicated. */
const DEDUPE_WINDOW_DAYS = 30;

/** A form filled in faster than this was filled in by a script. */
const MIN_FILL_MS = 3_000;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/**
 * Accepts the slug, the label, or anything close to either. An option added to
 * a live site before this list catches up must not cost us the lead, so an
 * unrecognised answer becomes 'other' and the raw text is kept for the notes.
 */
export function matchChoice(value: unknown, options: Choice[]): { slug: string; raw: string } {
  const raw = cleanText(value, 120);
  if (!raw) return { slug: '', raw: '' };

  const needle = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const hit = options.find(
    (o) => o.slug === needle || o.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === needle
  );
  return { slug: hit ? hit.slug : 'other', raw };
}

export const choiceLabel = (slug: string, options: Choice[]): string =>
  options.find((o) => o.slug === slug)?.label ?? slug;

export interface LeadIntakeInput {
  full_name: string;
  email: string;
  phone: string;
  interest: string;
  interestRaw: string;
  goal: string;
  goalRaw: string;
  message: string;
  lead_source: string;
  tracking_phone: string;
  meta: Record<string, string>;
}

export interface ParsedIntake {
  lead?: LeadIntakeInput;
  fields?: Record<string, string>;
  /** Looked like a bot. Answer as though it worked and store nothing. */
  silentlyDrop?: boolean;
}

/**
 * Validate a posted body. Field keys match the payload names the sites send.
 *
 * `trustedSource` is the domain the browser actually posted from, read from the
 * Origin header. It wins over the hidden `lead_source` field: with a hundred
 * sites sharing one key and one snippet, nobody is going to keep a hidden
 * field correct on every one of them, and a self-reported value can be edited
 * by whoever is posting. `fallbackSource` is the site record's label, used
 * only for a server-to-server post, which carries no Origin.
 */
export function parseIntake(
  body: Record<string, unknown>,
  fallbackSource: string,
  trustedSource = ''
): ParsedIntake {
  // Honeypot: a real person never sees this input, so anything in it is a bot.
  if (cleanText(body.company, 200)) return { silentlyDrop: true };

  const ts = Number(body.ts);
  if (Number.isFinite(ts) && ts > 0) {
    const elapsed = Date.now() - ts;
    // A future timestamp is a forged one; too fast is a script.
    if (elapsed < MIN_FILL_MS) return { silentlyDrop: true };
  }

  const full_name = cleanText(body.full_name ?? body.name, 200);
  const email = normaliseEmail(body.email);
  const phone = cleanText(body.phone, 50);
  const message = cleanMultiline(body.message, 5000);
  const interest = matchChoice(body.interest, INTEREST_OPTIONS);
  const goal = matchChoice(body.goal, GOAL_OPTIONS);

  const fields: Record<string, string> = {};
  if (!isPersonName(full_name)) fields.full_name = 'Enter your full name.';
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  if (!phone) fields.phone = 'A phone number is required.';
  else if (!isPhone(phone)) fields.phone = 'Enter a valid phone number.';
  if (!interest.slug) fields.interest = 'Choose what you are interested in.';
  if (!goal.slug) fields.goal = 'Choose your primary goal.';
  if (Object.keys(fields).length) return { fields };

  const meta: Record<string, string> = {};
  const page_url = cleanText(body.page_url, 500);
  const referrer = cleanText(body.referrer, 500);
  if (page_url) meta.page_url = page_url;
  if (referrer) meta.referrer = referrer;
  for (const key of UTM_KEYS) {
    const value = cleanText(body[key], 120);
    if (value) meta[key] = value;
  }

  return {
    lead: {
      full_name,
      email,
      phone,
      interest: interest.slug,
      interestRaw: interest.raw,
      goal: goal.slug,
      goalRaw: goal.raw,
      message,
      // The domain it really came from, then what the form claimed, then the
      // site record's label. A site that forgets the hidden field is still
      // attributed correctly.
      lead_source: trustedSource || cleanText(body.lead_source, 120) || fallbackSource,
      tracking_phone: cleanText(body.tracking_phone, 50),
      meta,
    },
  };
}

/**
 * What a salesperson reads in the CRM. The dropdown answers are written out in
 * full so the lead is legible without cross-referencing a slug list, and the
 * raw answer is kept when it did not match an option we know.
 */
export function buildNotes(lead: LeadIntakeInput): string {
  const interest = choiceLabel(lead.interest, INTEREST_OPTIONS);
  const goal = choiceLabel(lead.goal, GOAL_OPTIONS);
  const lines = [
    `Interested in: ${interest}${lead.interest === 'other' && lead.interestRaw ? ` (${lead.interestRaw})` : ''}`,
    `Primary goal: ${goal}${lead.goal === 'other' && lead.goalRaw ? ` (${lead.goalRaw})` : ''}`,
    `From: ${lead.lead_source}${lead.tracking_phone ? ` · called number ${lead.tracking_phone}` : ''}`,
  ];
  if (lead.message) lines.push('', lead.message);
  const utm = UTM_KEYS.filter((k) => lead.meta[k]).map((k) => `${k.replace('utm_', '')}=${lead.meta[k]}`);
  if (utm.length) lines.push('', `Campaign: ${utm.join(' · ')}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------ site keys -- */

export interface LeadSite {
  id: string;
  site_key: string;
  label: string;
  domains: string;
  tracking_phone: string | null;
  post_secret: string | null;
  is_active: boolean;
}

/** True when the lead_sites table has not been created yet (0023 not run). */
export function missingLeadSites(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .*lead_sites.* does not exist|could not find the table/i.test(error.message ?? '')
  );
}

/** Columns 0023 adds to `leads`; absent until the owner runs it. */
export function missingIntakeColumns(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
  );
}

export function hostOf(value: string | null): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Which domains a key accepts, read from the one text box the dashboard edits.
 *
 * The owner buys these domains steadily, a hundred and counting, so the
 * default is deliberately open: leave the box empty and any site that has the
 * key can post, and a new domain works the moment its snippet goes up, with no
 * dashboard step at all. Attribution does not depend on this list - the domain
 * is read from the request itself - so an unknown site still reports itself
 * correctly in Leads.
 *
 * Two ways to narrow it, both typed into the same box:
 *   `peptidesoklahomacity.com`   only these domains may post (an allow-list)
 *   `!spammy.example.com`        this domain may never post (a block)
 *
 * A block always wins. A bare domain covers its subdomains, so `example.com`
 * also matches `go.example.com` but never `notexample.com`.
 */
export interface DomainRules {
  allow: string[];
  block: string[];
}

const normaliseDomain = (value: string): string =>
  value.trim().toLowerCase()
    .replace(/^!/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

export function domainRules(domains: string): DomainRules {
  const allow: string[] = [];
  const block: string[] = [];

  for (const entry of (domains || '').split(/[,\s]+/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const domain = normaliseDomain(trimmed);
    if (!domain) continue;
    (trimmed.startsWith('!') ? block : allow).push(domain);
  }

  return { allow, block };
}

const matches = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`);

/** May a request from this origin post against this key? */
export function originAllowed(domains: string, origin: string | null): boolean {
  const host = hostOf(origin);
  if (!host) return false;

  const { allow, block } = domainRules(domains);
  if (block.some((domain) => matches(host, domain))) return false;

  // No allow-list means every domain holding the key is accepted. That is the
  // point: buying a domain should not mean editing a list.
  if (!allow.length) return true;

  return allow.some((domain) => matches(host, domain));
}

/* ---------------------------------------------------------------- dedupe -- */

export const dedupeSince = (): string =>
  new Date(Date.now() - DEDUPE_WINDOW_DAYS * 86_400_000).toISOString();
