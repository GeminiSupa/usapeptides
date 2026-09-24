/**
 * Deliverability arithmetic: how much a new domain may send today, and what in
 * an email is likely to get it filtered.
 *
 * Pure functions, no I/O, no `server-only` - the builder shows the same score
 * live as the API records. Everything here is advice, not enforcement; the
 * daily cap is enforced in the database by email_reserve_sends.
 */

/* ------------------------------------------------------------- warm-up --- */

/**
 * The ramp. A domain nobody has heard of that sends 500 emails on day one gets
 * its first impression made by a spam filter, and that impression is expensive
 * to undo. Each pair is [day number the step begins on, emails allowed that day].
 *
 * Roughly the schedule the big providers publish: small, steady, doubling
 * about every three days, never a jump of more than 2x.
 */
export const WARMUP_SCHEDULE: [day: number, cap: number][] = [
  [1, 25],
  [4, 50],
  [7, 100],
  [10, 200],
  [14, 400],
  [18, 800],
  [22, 1500],
];

/** The day after which the warm-up is over and the ceiling is the owner's. */
export const WARMUP_DAYS = 26;

export interface Policy {
  warmup_enabled: boolean;
  warmup_started_on: string | null;
  daily_cap_override: number | null;
  max_daily_cap: number;
}

export const DEFAULT_POLICY: Policy = {
  warmup_enabled: true,
  warmup_started_on: null,
  daily_cap_override: null,
  max_daily_cap: 2000,
};

/** Whole days since the warm-up began, counting the first day as day 1. */
export function warmupDay(startedOn: string | null | undefined, now = new Date()): number {
  if (!startedOn) return 1;
  const start = Date.parse(`${String(startedOn).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start)) return 1;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(1, Math.floor((today - start) / 86_400_000) + 1);
}

/** What the schedule allows on a given day of the warm-up. */
export function warmupCap(day: number, maxDailyCap: number): number {
  if (day > WARMUP_DAYS) return maxDailyCap;
  let cap = WARMUP_SCHEDULE[0][1];
  for (const [from, value] of WARMUP_SCHEDULE) if (day >= from) cap = value;
  return Math.min(cap, maxDailyCap);
}

export interface CapToday {
  cap: number;
  /** Plain English, shown on the panel and in the API error when it runs out. */
  reason: string;
  warmupDay: number | null;
}

/** The number of emails this deployment may send today, and why. */
export function dailyCap(policy: Policy, now = new Date()): CapToday {
  const max = Math.max(0, Math.round(Number(policy.max_daily_cap) || 0));

  // Deliberately not `Number(x) >= 0`: Number(null) is 0, which would read an
  // unset override as a cap of zero and stop every email the site sends.
  const raw: unknown = policy.daily_cap_override;
  const override = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(override) && override >= 0) {
    return { cap: Math.min(override, max), reason: 'A manual daily limit is set.', warmupDay: null };
  }
  if (!policy.warmup_enabled) {
    return { cap: max, reason: 'Warm-up is off, so the full daily limit applies.', warmupDay: null };
  }

  const day = warmupDay(policy.warmup_started_on, now);
  if (day > WARMUP_DAYS) {
    return { cap: max, reason: 'Warm-up finished, so the full daily limit applies.', warmupDay: day };
  }
  return {
    cap: warmupCap(day, max),
    reason: `Day ${day} of the ${WARMUP_DAYS}-day warm-up.`,
    warmupDay: day,
  };
}

/* ---------------------------------------------------------- spam checks --- */

/**
 * Words and shapes that filters weigh against a sender with no reputation yet.
 * Not a blocklist - a nudge. Every one of these has been sent by a legitimate
 * business; they just cost a new domain more than they are worth.
 */
const RISKY_PHRASES = [
  'act now', 'apply now', 'buy direct', 'call now', 'cash bonus', 'cheap',
  'click here', 'congratulations', 'credit card', 'dear friend', 'discount',
  'double your', 'earn money', 'exclusive deal', 'expires', 'free access',
  'free gift', 'free money', 'free trial', 'get paid', 'guarantee',
  'incredible deal', 'limited time', 'lowest price', 'make money', 'miracle',
  'no obligation', 'no risk', 'once in a lifetime', 'only today', 'order now',
  'risk free', 'satisfaction guaranteed', 'special promotion', 'this is not spam',
  'urgent', 'while supplies last', 'winner', 'you have been selected',
];

/** Words that get a supplement or peptide seller filtered specifically. */
const CLAIM_PHRASES = [
  'cure', 'cures', 'treat disease', 'fda approved', 'clinically proven',
  'lose weight fast', 'anti-aging miracle', 'reverse aging', 'prescription free',
];

export type Severity = 'high' | 'medium' | 'low';

export interface SpamFinding {
  severity: Severity;
  message: string;
  /** What to do about it, in one line. */
  fix: string;
}

export interface SpamReport {
  /** 0 is clean. Anything over 40 is likely to land in spam. */
  score: number;
  verdict: 'good' | 'fair' | 'poor';
  findings: SpamFinding[];
}

export interface EmailForCheck {
  subject: string;
  previewText?: string;
  /** The words a person reads, with the HTML already stripped out. */
  text: string;
  linkCount?: number;
  imageCount?: number;
  hasUnsubscribe?: boolean;
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

const capsRatio = (s: string) => {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 8) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
};

/** Everything worth saying about one email, worst first. */
export function checkEmail(email: EmailForCheck): SpamReport {
  const findings: SpamFinding[] = [];
  const subject = String(email.subject ?? '');
  const text = String(email.text ?? '');
  const body = `${subject} ${email.previewText ?? ''} ${text}`.toLowerCase();
  let score = 0;

  const add = (severity: Severity, message: string, fix: string, weight: number) => {
    findings.push({ severity, message, fix });
    score += weight;
  };

  if (!subject.trim()) {
    add('high', 'There is no subject line.', 'Write a plain, specific subject.', 25);
  } else {
    if (subject.length > 65) {
      add('low', `The subject is ${subject.length} characters, so phones will cut it off.`, 'Aim for under 55 characters.', 3);
    }
    if (capsRatio(subject) > 0.5) {
      add('high', 'The subject is mostly capital letters.', 'Write it in normal sentence case.', 15);
    }
    const bangs = (subject.match(/[!?]/g) ?? []).length;
    if (bangs > 1) {
      add('medium', 'The subject has several exclamation or question marks.', 'Keep at most one.', 8);
    }
    // Astral emoji arrive as a surrogate pair, so match the high surrogate
    // range rather than using the /u flag, which this build target rejects.
    if (/[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(subject)) {
      add('low', 'The subject contains emoji.', 'A new domain is better off without them for the first few weeks.', 4);
    }
    if (/\$|\bfree\b|%\s*off/i.test(subject)) {
      add('medium', 'The subject leads with a price, a discount or the word free.', 'Say what is inside instead, and keep the offer for the body.', 7);
    }
  }

  const matched = RISKY_PHRASES.filter((p) => body.includes(p));
  if (matched.length) {
    add(
      matched.length > 3 ? 'high' : 'medium',
      `${matched.length} phrase${matched.length === 1 ? '' : 's'} filters watch for: ${matched.slice(0, 5).join(', ')}.`,
      'Rewrite those in your own plain words.',
      Math.min(24, matched.length * 6)
    );
  }

  const claims = CLAIM_PHRASES.filter((p) => body.includes(p));
  if (claims.length) {
    add(
      'high',
      `Health claims filters treat as high risk: ${claims.slice(0, 4).join(', ')}.`,
      'Remove them. Research-use copy should make no medical claim at all.',
      Math.min(30, claims.length * 12)
    );
  }

  const words = countWords(text);
  if (words < 25) {
    add('medium', `The email is only ${words} words long.`, 'A near-empty email with a link looks like a phishing attempt. Write at least a short paragraph.', 10);
  }

  const images = Number(email.imageCount ?? 0);
  if (images > 0 && words < 60) {
    add('medium', 'The email is mostly image with very little text.', 'Add real text - filters cannot read a picture.', 9);
  }

  const links = Number(email.linkCount ?? 0);
  if (links > 8) {
    add('medium', `There are ${links} links.`, 'Cut it to the few that matter.', 8);
  }
  if (links === 0 && words > 40) {
    add('low', 'There is no link at all.', 'Not a problem, but people cannot act on it.', 0);
  }

  if (email.hasUnsubscribe === false) {
    add('high', 'There is no unsubscribe link.', 'Required by law and by every filter. The layout adds one automatically - do not remove it.', 25);
  }

  if (capsRatio(text) > 0.4 && text.length > 40) {
    add('medium', 'The body is largely capital letters.', 'Write it normally.', 10);
  }

  score = Math.min(100, score);
  const verdict: SpamReport['verdict'] = score >= 40 ? 'poor' : score >= 15 ? 'fair' : 'good';
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, verdict, findings };
}

export const VERDICT_LABEL: Record<SpamReport['verdict'], string> = {
  good: 'Looks fine',
  fair: 'Could be better',
  poor: 'Likely to be filtered',
};
