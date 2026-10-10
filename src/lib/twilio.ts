import 'server-only';

import twilio from 'twilio';

import { twilioEnv, features } from './env';

/**
 * Twilio: text messages, WhatsApp, Studio Flows and the token that lets the
 * dashboard place a call from the browser.
 *
 * Two things here are easy to get wrong and expensive to debug:
 *
 *   1. The REST client authenticates with the API key, not the auth token.
 *      Both work, but a key can be revoked on its own, so a leak from this
 *      deployment never reaches anything else on the account.
 *
 *   2. A voice access token MUST be signed with the API key and secret.
 *      `new AccessToken(accountSid, accountSid, authToken, ...)` compiles,
 *      looks reasonable, and produces a JWT that Twilio rejects at call time
 *      with an error that says nothing about signing.
 *
 * Nothing in this file throws on missing credentials. Callers check the
 * feature flags and return a 503 that names what is missing, because a
 * deployment without Twilio is a supported deployment.
 */

/* ------------------------------------------------------------------ numbers */

/**
 * E.164, which is what Twilio accepts and what its logs return.
 *
 * A ten-digit number is read as US/Canada. Anything shorter is not a phone
 * number, and anything that still has letters in it after stripping
 * punctuation is rejected rather than guessed at — dialling a wrong number is
 * worse than refusing an ambiguous one.
 */
export function toE164(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;

  // Reject anything with letters or stray characters beyond normal separators.
  if (/[^\d\s()+\-.]/.test(trimmed)) return null;

  if (plus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export const isE164 = (v: unknown): v is string =>
  typeof v === 'string' && /^\+[1-9]\d{7,14}$/.test(v);

/** Splits a pasted list — newlines, commas or semicolons — into numbers. */
export function parseRecipientList(raw: unknown): { valid: string[]; invalid: string[] } {
  if (typeof raw !== 'string') return { valid: [], invalid: [] };

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw.split(/[\n,;]+/)) {
    const text = entry.trim();
    if (!text) continue;
    const number = toE164(text);
    if (!number) { invalid.push(text); continue; }
    if (seen.has(number)) continue;
    seen.add(number);
    valid.push(number);
  }

  return { valid, invalid };
}

/* ------------------------------------------------------------------- client */

let cached: ReturnType<typeof twilio> | null = null;

/** The REST client, or null when this deployment has no Twilio credentials. */
export function getTwilioClient() {
  if (!features.twilio) return null;
  if (!cached) {
    cached = twilio(twilioEnv.apiKey, twilioEnv.apiSecret, {
      accountSid: twilioEnv.accountSid,
    });
  }
  return cached;
}

/* -------------------------------------------------------------------- token */

/** An hour. The browser refreshes on `tokenWillExpire` well before this. */
export const VOICE_TOKEN_TTL_SECONDS = 3600;

/**
 * A capability token for the Voice SDK running in an admin's browser.
 *
 * `identity` is who the token is for. It appears in Twilio's logs against
 * every call placed with it, which is the only reason a call can later be
 * attributed to a person.
 */
export function createVoiceToken(identity: string): { token: string; identity: string; expiresInSeconds: number } {
  if (!features.twilioVoice) {
    throw new Error('Twilio voice is not configured for this deployment.');
  }

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  // Signed with the API key. See the note at the top of this file.
  const token = new AccessToken(twilioEnv.accountSid, twilioEnv.apiKey, twilioEnv.apiSecret, {
    identity,
    ttl: VOICE_TOKEN_TTL_SECONDS,
  });

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: twilioEnv.twimlAppSid,
      // Nothing here answers inbound calls, and allowing them would ring a
      // browser tab nobody is watching.
      incomingAllow: false,
    })
  );

  return {
    token: token.toJwt(),
    identity,
    expiresInSeconds: VOICE_TOKEN_TTL_SECONDS,
  };
}

/**
 * Twilio identities allow a narrow character set, and an email address is not
 * in it. The address is still recognisable in the log, which is the point.
 */
export const voiceIdentityFor = (email: string): string =>
  `admin-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`.slice(0, 120);

/* ------------------------------------------------------------------ sending */

export interface SendResult {
  to: string;
  ok: boolean;
  sid?: string;
  status?: string;
  error?: string;
}

/** The text of an outgoing message, capped at Twilio's own limit. */
export const clipBody = (raw: unknown): string =>
  typeof raw === 'string' ? raw.trim().slice(0, 1600) : '';

export async function sendSms(to: string, body: string, from: string): Promise<SendResult> {
  const client = getTwilioClient();
  if (!client || !from) {
    return { to, ok: false, error: 'Text messaging is not configured.' };
  }

  try {
    const message = await client.messages.create({ to, from, body });
    return { to, ok: true, sid: message.sid, status: message.status };
  } catch (err) {
    return { to, ok: false, error: twilioErrorMessage(err) };
  }
}

export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const client = getTwilioClient();
  if (!client || !twilioEnv.whatsappFrom) {
    return { to, ok: false, error: 'WhatsApp is not configured.' };
  }

  try {
    const message = await client.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${twilioEnv.whatsappFrom}`,
      body,
    });
    return { to, ok: true, sid: message.sid, status: message.status };
  } catch (err) {
    return { to, ok: false, error: twilioErrorMessage(err) };
  }
}

/**
 * Sends to a list, one at a time.
 *
 * Deliberately sequential. Twilio queues per-number anyway, and firing a few
 * hundred requests at once is how an account hits its concurrency limit and
 * gets a batch of failures that look like bad numbers.
 */
export async function sendBulkSms(
  recipients: string[],
  body: string,
  from: string,
  limit = 200
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const to of recipients.slice(0, limit)) {
    results.push(await sendSms(to, body, from));
  }
  return results;
}

export async function triggerStudioFlow(
  flowSid: string,
  to: string,
  from: string,
  parameters: Record<string, unknown> = {}
): Promise<SendResult> {
  const client = getTwilioClient();
  if (!client || !from) {
    return { to, ok: false, error: 'Studio Flows are not configured.' };
  }

  try {
    const execution = await client.studio.v2
      .flows(flowSid)
      .executions.create({ to, from, parameters });
    return { to, ok: true, sid: execution.sid, status: execution.status };
  } catch (err) {
    return { to, ok: false, error: twilioErrorMessage(err) };
  }
}

/* ------------------------------------------------------------- the numbers */

export interface AccountNumber {
  phoneNumber: string;
  friendlyName: string;
  voice: boolean;
  sms: boolean;
  mms: boolean;
  /**
   * Where an INCOMING call to this number goes today. Sending from a number
   * does not change this, so a person who calls back reaches whatever is set
   * here - which, on a shared account, may belong to something else
   * entirely. The dashboard shows it so the choice is made with open eyes.
   */
  incomingGoesTo: 'this dashboard' | 'a studio flow' | 'another app' | 'a webhook' | 'nothing';
}

/**
 * Every number on the account, paged through in full.
 *
 * Twilio returns 100 at a time and this account holds hundreds, so a single
 * unpaged request silently returns a partial list - which, used for
 * validation, would reject numbers the business really does own.
 */
export async function listAccountNumbers(): Promise<AccountNumber[]> {
  const client = getTwilioClient();
  if (!client) return [];

  const rows = await client.incomingPhoneNumbers.list({ limit: 1000 });

  return rows
    .map((n) => {
      const caps = (n.capabilities ?? {}) as { voice?: boolean; sms?: boolean; mms?: boolean };
      return {
        phoneNumber: n.phoneNumber ?? '',
        friendlyName: n.friendlyName ?? n.phoneNumber ?? '',
        voice: Boolean(caps.voice),
        sms: Boolean(caps.sms),
        mms: Boolean(caps.mms),
        incomingGoesTo: describeIncoming(n.voiceApplicationSid, n.voiceUrl),
      };
    })
    .filter((n) => n.phoneNumber)
    .sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));
}

function describeIncoming(appSid: string | null | undefined, voiceUrl: string | null | undefined): AccountNumber['incomingGoesTo'] {
  if (appSid && appSid === twilioEnv.twimlAppSid) return 'this dashboard';
  if (appSid) return 'another app';
  if (voiceUrl && /\/v1\/Accounts\/[^/]+\/Flows\//.test(voiceUrl)) return 'a studio flow';
  if (voiceUrl) return 'a webhook';
  return 'nothing';
}

/**
 * The set of numbers the account owns, cached briefly.
 *
 * Used to check that a sender asked for by the browser is really ours. The
 * check has to happen server-side on every send: without it, a crafted
 * request could set any `from` it liked, and Twilio would reject it - or
 * worse, accept it if the account happened to own it for another purpose.
 *
 * A short cache keeps a 200-number page fetch off every single send in a
 * bulk run, while still picking up a number bought minutes ago.
 */
const OWNED_CACHE_MS = 5 * 60 * 1000;
let ownedCache: { at: number; numbers: Set<string> } | null = null;

export async function ownedNumbers(): Promise<Set<string>> {
  if (ownedCache && Date.now() - ownedCache.at < OWNED_CACHE_MS) return ownedCache.numbers;

  const numbers = new Set((await listAccountNumbers()).map((n) => n.phoneNumber));
  ownedCache = { at: Date.now(), numbers };
  return numbers;
}

/** Forget the cached list, after a number is bought or released elsewhere. */
export const forgetOwnedNumbers = (): void => { ownedCache = null; };

/**
 * Decide which of our numbers a message or call goes out from.
 *
 * Pure, and separated out so the rule is testable: an explicit request wins
 * if we genuinely own that number, otherwise the configured default, and a
 * requested number we do not own is refused rather than quietly swapped -
 * sending from an unexpected number is worse than not sending.
 */
export function chooseSender(
  requested: unknown,
  owned: Set<string>,
  fallback: string | null
): { ok: true; from: string } | { ok: false; error: string } {
  const wanted = typeof requested === 'string' && requested.trim() ? toE164(requested) : null;

  if (typeof requested === 'string' && requested.trim() && !wanted) {
    return { ok: false, error: 'That sending number is not a valid phone number.' };
  }

  if (wanted) {
    if (!owned.has(wanted)) {
      return { ok: false, error: 'That number is not on this Twilio account. Pick one from the list.' };
    }
    return { ok: true, from: wanted };
  }

  const chosen = fallback && owned.has(fallback) ? fallback : null;
  if (!chosen) {
    return { ok: false, error: 'Choose which number to send from.' };
  }
  return { ok: true, from: chosen };
}

/* --------------------------------------------------------------------- logs */

export interface MessageLogEntry {
  sid: string;
  direction: string;
  from: string;
  to: string;
  body: string;
  status: string;
  channel: 'sms' | 'whatsapp';
  errorMessage: string | null;
  sentAt: string | null;
}

export async function listMessages(limit = 40): Promise<MessageLogEntry[]> {
  const client = getTwilioClient();
  if (!client) return [];

  const rows = await client.messages.list({ limit: Math.min(Math.max(limit, 1), 100) });

  return rows.map((m) => ({
    sid: m.sid,
    direction: m.direction ?? '',
    from: stripChannel(m.from ?? ''),
    to: stripChannel(m.to ?? ''),
    body: m.body ?? '',
    status: m.status ?? '',
    channel: (m.from ?? '').startsWith('whatsapp:') || (m.to ?? '').startsWith('whatsapp:')
      ? 'whatsapp'
      : 'sms',
    errorMessage: m.errorMessage ?? null,
    sentAt: toIso(m.dateSent ?? m.dateCreated),
  }));
}

export interface CallLogEntry {
  sid: string;
  direction: string;
  from: string;
  to: string;
  status: string;
  durationSeconds: number;
  startedAt: string | null;
  price: string | null;
}

export async function listCalls(limit = 40): Promise<CallLogEntry[]> {
  const client = getTwilioClient();
  if (!client) return [];

  const rows = await client.calls.list({ limit: Math.min(Math.max(limit, 1), 100) });

  return rows.map((c) => ({
    sid: c.sid,
    direction: c.direction ?? '',
    from: stripChannel(c.from ?? ''),
    to: stripChannel(c.to ?? ''),
    status: c.status ?? '',
    durationSeconds: Number(c.duration ?? 0) || 0,
    startedAt: toIso(c.startTime ?? c.dateCreated),
    price: c.price ?? null,
  }));
}

/* ------------------------------------------------------------------ helpers */

const stripChannel = (v: string): string => v.replace(/^whatsapp:/, '');

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Twilio's errors carry a numeric code and a help page. Both are worth
 * keeping: the code is what a support ticket needs, and the message alone is
 * often too vague to act on.
 */
export function twilioErrorMessage(err: unknown): string {
  const e = err as { message?: string; code?: number; moreInfo?: string } | null;
  if (!e) return 'Twilio rejected the request.';
  const code = e.code ? ` (Twilio error ${e.code})` : '';
  return `${e.message ?? 'Twilio rejected the request.'}${code}`;
}

/**
 * What the dashboard shows at the top of the panel.
 *
 * The phone number is included because it is public information printed on
 * every message the business sends. No key, secret or token is ever returned.
 */
export function twilioStatus() {
  return {
    configured: features.twilio,
    sms: features.twilioSms,
    whatsapp: features.twilioWhatsApp,
    voice: features.twilioVoice,
    flows: features.twilioFlows,
    fromNumber: twilioEnv.phoneNumber || null,
    whatsappFrom: twilioEnv.whatsappFrom || null,
    studioFlows: twilioEnv.studioFlows.map((f) => ({ label: f.label, sid: f.sid })),
    missing: {
      accountSid: !twilioEnv.accountSid,
      authToken: !twilioEnv.authToken,
      apiKey: !twilioEnv.apiKey,
      apiSecret: !twilioEnv.apiSecret,
      twimlAppSid: !twilioEnv.twimlAppSid,
      // TWILIO_PHONE_NUMBER is deliberately absent: it is only the default
      // pick now, and the sender is chosen from the account's own list.
    },
  };
}

export const isKnownFlowSid = (sid: unknown): sid is string =>
  typeof sid === 'string' && twilioEnv.studioFlows.some((f) => f.sid === sid);
