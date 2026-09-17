import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { BUSINESS, features, smtpEnv, supabaseEnv } from './env';
import { getSupabaseAdmin } from './supabaseAdmin';
import { getSiteContent } from './siteContentServer';
import {
  personalize, renderEmailHtml, renderEmailText, safeEmailUrl, sanitizeDesign,
  type AudienceFilterId, type AudienceId,
} from './emailDesign';

/**
 * Sending campaigns.
 *
 * Recipients are frozen into campaign_recipients when a campaign starts, then
 * sent in small batches so one request never runs past the platform's time
 * limit and the mail server is not hit with hundreds of messages at once.
 * Whoever has the Campaigns screen open keeps the batches going; the cron route
 * picks up scheduled and unfinished campaigns as a backstop.
 *
 * Every address on email_suppressions (unsubscribed, bounced) is skipped, from
 * whichever list it came.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export const BATCH_SIZE = Math.max(1, Math.min(200, Number(process.env.EMAIL_BATCH_SIZE) || 40));
const SEND_DELAY_MS = Math.max(0, Number(process.env.EMAIL_SEND_DELAY_MS) || 400);
const BATCH_BUDGET_MS = 45_000;

export const siteUrl = () => BUSINESS.domain.replace(/\/+$/, '');

export class CampaignError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/* --------------------------------------------------------------- tokens -- */

/**
 * Signs tracking and unsubscribe links, so nobody can unsubscribe someone else
 * or forge clicks by editing a URL. EMAIL_LINK_SECRET is preferred; without it
 * a key is derived from the service role key, which never leaves the server.
 */
function secret(): string {
  const configured = String(process.env.EMAIL_LINK_SECRET ?? '').trim();
  if (configured) return configured;
  return createHmac('sha256', supabaseEnv.serviceRoleKey || 'unset').update('email-link-secret-v1').digest('hex');
}

export const signLink = (...parts: string[]) =>
  createHmac('sha256', secret()).update(parts.join('|')).digest('base64url').slice(0, 32);

export function verifyLink(token: string | null, ...parts: string[]): boolean {
  if (!token) return false;
  const expected = Buffer.from(signLink(...parts));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const unsubscribeUrl = (recipientId: string) =>
  `${siteUrl()}/api/email/unsubscribe?r=${recipientId}&t=${signLink('u', recipientId)}`;

/* ------------------------------------------------------------ audiences -- */

export interface Recipient { email: string; name: string | null; source: string }

const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new CampaignError(error.message, 500);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function suppressedEmails(db: Db): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const rows = await all<{ email: string }>((a, b) => db.from('email_suppressions').select('email').range(a, b));
    rows.forEach((r) => set.add(normEmail(r.email)));
  } catch { /* table arrives with 0017; nothing suppressed before it */ }
  const unsubscribed = await all<{ email: string }>((a, b) => db.from('newsletter_subscribers').select('email').eq('is_subscribed', false).range(a, b));
  unsubscribed.forEach((r) => set.add(normEmail(r.email)));
  return set;
}

export async function buildAudience(db: Db, audience: AudienceId, filter: AudienceFilterId): Promise<Recipient[]> {
  const byEmail = new Map<string, Recipient>();
  const add = (email: unknown, name: unknown, source: string) => {
    const e = normEmail(email);
    if (!validEmail(e)) return;
    const existing = byEmail.get(e);
    if (!existing) byEmail.set(e, { email: e, name: String(name ?? '').trim() || null, source });
    else if (!existing.name && name) existing.name = String(name).trim();
  };

  if (audience === 'subscribers' || audience === 'everyone') {
    (await all<{ email: string }>((a, b) => db.from('newsletter_subscribers').select('email').eq('is_subscribed', true).range(a, b)))
      .forEach((r) => add(r.email, null, 'subscriber'));
  }
  if (audience === 'customers' || audience === 'all_customers' || audience === 'everyone') {
    (await all<{ email: string; full_name: string | null }>((a, b) => {
      let q = db.from('customer_profiles').select('email, full_name');
      if (audience !== 'all_customers') q = q.eq('marketing_opt_in', true);
      return q.range(a, b);
    })).forEach((r) => add(r.email, r.full_name, 'customer'));
  }
  if (audience === 'leads' || audience === 'everyone') {
    (await all<{ email: string | null; full_name: string | null; status: string }>((a, b) => db.from('leads').select('email, full_name, status').not('email', 'is', null).range(a, b)))
      .filter((r) => r.status !== 'lost')
      .forEach((r) => add(r.email, r.full_name, 'lead'));
  }

  const suppressed = await suppressedEmails(db);
  let list = Array.from(byEmail.values()).filter((r) => !suppressed.has(r.email));

  if (filter === 'buyers' || filter === 'non_buyers') {
    const buyers = new Set((await all<{ email: string }>((a, b) => db.from('orders').select('email').neq('status', 'cancelled').range(a, b))).map((r) => normEmail(r.email)));
    list = list.filter((r) => (filter === 'buyers') === buyers.has(r.email));
  } else if (filter === 'engaged' || filter === 'dormant') {
    const days = filter === 'engaged' ? 90 : 180;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let active = new Set<string>();
    try {
      active = new Set((await all<{ email: string }>((a, b) => db.from('campaign_recipients').select('email').gte('opened_at', since).range(a, b))).map((r) => normEmail(r.email)));
    } catch { /* before 0017 nobody has engagement history */ }
    list = list.filter((r) => (filter === 'engaged') === active.has(r.email));
  }

  return list.sort((a, b) => a.email.localeCompare(b.email));
}

/* --------------------------------------------------------------- sending -- */

let transport: Transporter | null = null;
function mailer() {
  if (!features.email) throw new CampaignError('Email sending is not connected yet. Add SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel, then redeploy.', 503);
  transport ??= nodemailer.createTransport({
    host: smtpEnv.host,
    port: smtpEnv.port,
    secure: smtpEnv.secure,
    auth: { user: smtpEnv.user, pass: smtpEnv.pass },
    pool: true,
    maxConnections: 1,
  });
  return transport;
}

interface CampaignRow {
  id: string; name: string; subject: string | null; preview_text: string | null; from_name: string | null;
  reply_to: string | null; design: unknown; status: string;
}

/** The HTML one person receives: their name filled in, links tracked, unsubscribe signed. */
async function composeFor(c: CampaignRow, r: { id: string; email: string; name: string | null }) {
  const content = await getSiteContent();
  const business = content['business.name'] || BUSINESS.name;
  const design = sanitizeDesign(c.design);
  // Merge fields are filled before rendering, so escaping still applies to them.
  design.blocks = design.blocks.map((b) => ({
    ...b,
    text: b.text !== undefined ? personalize(b.text, r, business) : undefined,
    label: b.label !== undefined ? personalize(b.label, r, business) : undefined,
  }));
  const subject = personalize(c.subject ?? c.name, r, business);
  const base = siteUrl();
  const unsub = unsubscribeUrl(r.id);
  const pixel = `<img src="${base}/api/email/open?r=${r.id}&t=${signLink('o', r.id)}" width="1" height="1" alt="" style="display:block;border:0;">`;
  const options = {
    businessName: business,
    siteUrl: base,
    address: content['contact.address'],
    previewText: personalize(c.preview_text ?? '', r, business),
    unsubscribeUrl: unsub,
    trailer: pixel,
  };

  let html = renderEmailHtml(design, subject, options);
  // Route links through the click tracker, except unsubscribe and mailto.
  html = html.replace(/href="([^"]+)"/g, (whole, raw: string) => {
    const url = raw.replace(/&amp;/g, '&');
    if (!/^https?:\/\//i.test(url) || url.startsWith(`${base}/api/email/`)) return whole;
    const target = url.startsWith(base) ? `${url}${url.includes('?') ? '&' : '?'}utm_source=email&utm_medium=campaign&utm_campaign=${c.id}` : url;
    const link = `${base}/api/email/click?r=${r.id}&u=${encodeURIComponent(target)}&t=${signLink('c', r.id, target)}`;
    return `href="${link.replace(/&/g, '&amp;')}"`;
  });

  return { subject, html, text: renderEmailText(design, options), unsub, business };
}

async function sendOne(c: CampaignRow, r: { id: string; email: string; name: string | null }, to = r.email) {
  const { subject, html, text, unsub, business } = await composeFor(c, r);
  const fromName = (c.from_name || business).replace(/["<>]/g, '');
  await mailer().sendMail({
    from: `"${fromName}" <${smtpEnv.from}>`,
    to,
    replyTo: c.reply_to || undefined,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Campaign-Id': c.id,
    },
  });
}

const CAMPAIGN_SELECT = 'id, name, subject, preview_text, from_name, reply_to, design, status';

async function loadCampaign(db: Db, id: string): Promise<CampaignRow> {
  const { data, error } = await db.from('campaigns').select(CAMPAIGN_SELECT).eq('id', id).maybeSingle();
  if (error) throw new CampaignError(/column|schema cache/i.test(error.message) ? 'Run migration 0017_campaigns.sql first.' : error.message, 500);
  if (!data) throw new CampaignError('That campaign no longer exists.', 404);
  return data as CampaignRow;
}

function checkReady(c: CampaignRow) {
  if (!c.subject?.trim()) throw new CampaignError('Add a subject line first.');
  if (!sanitizeDesign(c.design).blocks.length) throw new CampaignError('The email is empty. Add some content first.');
}

/** A test copy to the given addresses. Nothing is recorded against recipients. */
export async function sendTest(id: string, to: string[]) {
  const db = getSupabaseAdmin();
  const c = await loadCampaign(db, id);
  checkReady(c);
  const list = to.map(normEmail).filter(validEmail).slice(0, 5);
  if (!list.length) throw new CampaignError('Type an email address for the test.');
  for (const email of list) {
    await sendOne({ ...c, subject: `[Test] ${c.subject}` }, { id: '00000000-0000-0000-0000-000000000000', email, name: null }, email);
  }
  await db.from('campaigns').update({ last_test_at: new Date().toISOString() }).eq('id', id);
  return { sent: list.length };
}

/** Freeze the audience and move the campaign to sending (or scheduled). */
export async function startCampaign(id: string, audience: AudienceId, filter: AudienceFilterId, scheduledAt: string | null) {
  const db = getSupabaseAdmin();
  const c = await loadCampaign(db, id);
  checkReady(c);
  if (!['draft', 'paused', 'scheduled'].includes(c.status)) throw new CampaignError('This campaign has already been sent.');
  if (!scheduledAt) mailer(); // fail now, not halfway, when email is not connected

  const recipients = await buildAudience(db, audience, filter);
  if (!recipients.length) throw new CampaignError('Nobody is in that audience yet.');

  if (c.status === 'draft' || c.status === 'scheduled') {
    await db.from('campaign_recipients').delete().eq('campaign_id', id).eq('status', 'queued');
    for (let i = 0; i < recipients.length; i += 500) {
      const { error } = await db.from('campaign_recipients').upsert(
        recipients.slice(i, i + 500).map((r) => ({ campaign_id: id, email: r.email, name: r.name, source: r.source })),
        { onConflict: 'campaign_id,email', ignoreDuplicates: true }
      );
      if (error) throw new CampaignError(/campaign_recipients|schema cache/i.test(error.message) ? 'Run migration 0017_campaigns.sql first.' : error.message, 500);
    }
  }

  const later = scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 60_000;
  const { error } = await db.from('campaigns').update({
    audience, audience_filter: filter,
    recipient_count: recipients.length,
    status: later ? 'scheduled' : 'sending',
    scheduled_at: later ? scheduledAt : null,
    started_at: later ? null : new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new CampaignError(error.message, 500);
  return { recipients: recipients.length, status: later ? 'scheduled' : 'sending' };
}

/** Send the next batch. Safe to call repeatedly and from several places. */
export async function sendBatch(id: string) {
  const db = getSupabaseAdmin();
  const c = await loadCampaign(db, id);
  if (c.status !== 'sending') return { sent: 0, failed: 0, remaining: 0, status: c.status };

  const started = Date.now();
  const { data: queue, error } = await db.from('campaign_recipients')
    .select('id, email, name').eq('campaign_id', id).eq('status', 'queued').limit(BATCH_SIZE);
  if (error) throw new CampaignError(error.message, 500);

  const suppressed = await suppressedEmails(db);
  let sent = 0;
  let failed = 0;
  for (const r of queue ?? []) {
    if (Date.now() - started > BATCH_BUDGET_MS) break;
    // Claim the row first so two workers never send the same email twice.
    const { data: claimed } = await db.from('campaign_recipients')
      .update({ status: 'sending', claimed_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'queued').select('id').maybeSingle();
    if (!claimed) continue;

    if (suppressed.has(normEmail(r.email))) {
      await db.from('campaign_recipients').update({ status: 'skipped', error: 'Unsubscribed or blocked' }).eq('id', r.id);
      continue;
    }
    try {
      await sendOne(c, r);
      await db.from('campaign_recipients').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', r.id);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed';
      const permanent = /5\d\d|user unknown|does not exist|mailbox unavailable|invalid recipient/i.test(message);
      await db.from('campaign_recipients').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', r.id);
      if (permanent) {
        await db.from('email_suppressions').upsert({ email: normEmail(r.email), reason: 'bounced', campaign_id: id }, { onConflict: 'email', ignoreDuplicates: true });
      }
      failed += 1;
      if (err instanceof CampaignError) throw err;
    }
    if (SEND_DELAY_MS) await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
  }

  return finishIfDone(db, id, sent, failed);
}

async function finishIfDone(db: Db, id: string, sent: number, failed: number) {
  // A row stuck in "sending" (a worker died mid-send) is retried after 10 min.
  await db.from('campaign_recipients').update({ status: 'queued' })
    .eq('campaign_id', id).eq('status', 'sending').lt('claimed_at', new Date(Date.now() - 600_000).toISOString());

  const count = async (status: string) =>
    (await db.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', status)).count ?? 0;
  const [remaining, inFlight, sentTotal, failedTotal] = await Promise.all([count('queued'), count('sending'), count('sent'), count('failed')]);

  const done = remaining === 0 && inFlight === 0;
  await db.from('campaigns').update({
    sent_count: sentTotal,
    failed_count: failedTotal,
    ...(done ? { status: 'sent', completed_at: new Date().toISOString() } : {}),
  }).eq('id', id).eq('status', 'sending');

  return { sent, failed, remaining: remaining + inFlight, status: done ? 'sent' : 'sending' };
}

/** Start due scheduled campaigns and push unfinished ones along. For the cron. */
export async function processDueCampaigns() {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: due } = await db.from('campaigns').select('id').eq('status', 'scheduled').lte('scheduled_at', now).limit(10);
  for (const c of due ?? []) {
    await db.from('campaigns').update({ status: 'sending', started_at: now }).eq('id', c.id).eq('status', 'scheduled');
  }
  const { data: sending } = await db.from('campaigns').select('id').eq('status', 'sending').limit(5);
  const results: Record<string, unknown> = {};
  for (const c of sending ?? []) {
    try { results[c.id] = await sendBatch(c.id); } catch (err) { results[c.id] = { error: (err as Error).message }; }
  }
  return { started: due?.length ?? 0, processed: results };
}

/** Where a click is allowed to land: only the URL that was signed for it. */
export function clickTarget(url: string | null, recipientId: string, token: string | null): string | null {
  if (!url || !verifyLink(token, 'c', recipientId, url)) return null;
  return safeEmailUrl(url, siteUrl()) || null;
}
