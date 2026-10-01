import { timingSafeEqual } from 'node:crypto';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { readJson } from '@/lib/api';
import {
  LOCAL_LEAD_SOURCE,
  dedupeSince,
  missingIntakeColumns,
  originAllowed,
  parseIntake,
  hostOf,
  buildNotes,
  type LeadIntakeInput,
  type LeadSite,
} from '@/lib/leadIntake';
import { findLeadSite, intakeRateLimited } from '@/lib/leadSites';
import { notifyNewLead } from '@/lib/leadNotify';
import { fireTrigger } from '@/lib/automationEngine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/leads/intake — the contact form on a local lead-gen site.
 *
 * Public by design: the little city sites are static pages with no backend, so
 * the visitor's browser posts here directly. What stands in for a secret:
 *
 *   • the site key must exist in `lead_sites` and be active;
 *   • the browser's Origin must be a domain registered for that key (a site
 *     that can post server-side sends X-Site-Secret instead);
 *   • a honeypot field and a minimum fill time drop scripted submissions;
 *   • five posts per IP and twenty per site per ten minutes.
 *
 * Nothing about the CRM comes back in the response, so the worst a stolen key
 * buys is the ability to file junk leads from the domain it was stolen from —
 * and deactivating that key in the dashboard stops it immediately.
 *
 * Full spec, and the drop-in form for the sites: docs/LEAD-INTAKE-API.md
 */

/** CORS. The sites are on other domains, so every reply needs these. */
function cors(origin: string | null, allowed: boolean): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site-Key, X-Site-Secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const reply = (body: unknown, status: number, origin: string | null, allowed = true) =>
  Response.json(body, { status, headers: cors(origin, allowed) });

/**
 * The preflight cannot be authorised: the browser sends it before the request
 * that carries the key. It grants nothing on its own — the POST is checked in
 * full — so it is answered for any origin.
 */
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get('origin'), true) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');

  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body !== 'object') {
    return reply({ error: 'bad_request', message: 'Body must be JSON.' }, 400, origin, false);
  }

  const siteKey = (req.headers.get('x-site-key') || String(body.site_key ?? '')).trim().slice(0, 100);
  const { site, migrationMissing, error } = await findLeadSite(siteKey);

  if (migrationMissing) {
    // Named so whoever is wiring up the first site knows exactly what is left
    // to do, rather than seeing an opaque failure.
    return reply(
      {
        error: 'feature_unavailable',
        message:
          'Lead intake is not set up yet. Run supabase/migrations/0023_lead_intake.sql in the Supabase SQL editor, then add this site under Lead sites in the dashboard.',
      },
      503,
      origin,
      false
    );
  }
  if (error) return reply({ error: 'server_error', message: error }, 500, origin, false);

  if (!site || !site.is_active) {
    return reply({ error: 'unauthorized', message: 'Unknown or inactive site key.' }, 401, origin, false);
  }

  if (!authorised(req, site, origin)) {
    return reply(
      { error: 'unauthorized', message: 'This site key is not registered for this domain.' },
      401,
      origin,
      false
    );
  }

  // The domain the form was actually on. One key covers every site in the
  // network, so this - not the key - is what identifies a lead's origin and
  // what the per-domain rate limit counts.
  const sendingDomain = hostOf(origin) || hostOf(req.headers.get('referer'));

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await intakeRateLimited(ip, sendingDomain || site.site_key)) {
    return reply(
      { error: 'rate_limited', message: 'Too many submissions. Please wait a few minutes and try again.' },
      429,
      origin
    );
  }

  const parsed = parseIntake(body, site.label || site.site_key, sendingDomain);

  // A bot gets the same reply a person gets, so it learns nothing from ours.
  if (parsed.silentlyDrop) return reply({ data: { received: true } }, 201, origin);
  if (parsed.fields) return reply({ error: 'bad_request', message: 'Lead rejected.', fields: parsed.fields }, 400, origin);

  const lead = parsed.lead!;
  if (!lead.tracking_phone && site.tracking_phone) lead.tracking_phone = site.tracking_phone;
  lead.meta.user_agent = (req.headers.get('user-agent') ?? '').slice(0, 300);
  lead.meta.site_key = site.site_key;

  try {
    const saved = await store(lead);
    if ('failed' in saved) return reply({ error: 'server_error', message: saved.failed }, 500, origin);

    await notifyNewLead(lead, { isNew: saved.created, leadId: saved.id });

    // A new lead enters the same email sequence as one from our own contact
    // form, so a lead-gen lead is not a second class of lead.
    if (saved.created) {
      await fireTrigger('lead_created', {
        email: lead.email,
        name: lead.full_name,
        source: 'lead',
        subjectType: 'lead',
        subjectId: saved.id,
      });
    }

    return reply({ data: { received: true, id: saved.id } }, 201, origin);
  } catch (err) {
    return reply(
      { error: 'server_error', message: err instanceof Error ? err.message : 'Unexpected server error' },
      500,
      origin
    );
  }
}

/* -------------------------------------------------------------------------- */

/** A registered domain in the browser, or the shared secret server-to-server. */
function authorised(req: Request, site: LeadSite, origin: string | null): boolean {
  const supplied = req.headers.get('x-site-secret') ?? '';
  if (site.post_secret && supplied && secretMatches(supplied, site.post_secret)) return true;

  // Some browsers omit Origin on same-origin-ish posts; Referer still carries
  // the page, and the check below only reads its hostname.
  return originAllowed(site.domains, origin || req.headers.get('referer'));
}

function secretMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

type Stored = { id: string; created: boolean } | { failed: string };

/**
 * Write the lead, updating instead of duplicating when the same person came
 * back within the dedupe window.
 *
 * The columns migration 0023 adds are dropped and folded into the notes when
 * the migration has not been run, so the sites can go live the moment this
 * deploys and lose nothing but the reporting columns in the meantime.
 */
async function store(lead: LeadIntakeInput): Promise<Stored> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const notes = buildNotes(lead);

  const existing = await findRecent(lead);
  if ('failed' in existing) return existing;

  if (existing.id) {
    const patch: Record<string, unknown> = {
      phone: lead.phone || undefined,
      full_name: lead.full_name || undefined,
      last_contacted_at: now,
    };
    const extra = {
      lead_source: lead.lead_source,
      interest: lead.interest,
      goal: lead.goal,
      tracking_phone: lead.tracking_phone || null,
      meta: lead.meta,
    };

    let result = await db.from('leads').update({ ...patch, ...extra }).eq('id', existing.id);
    if (result.error && missingIntakeColumns(result.error)) {
      result = await db.from('leads').update(patch).eq('id', existing.id);
    }
    if (result.error) return { failed: result.error.message };

    // The salesperson's own notes and status are left alone; the new enquiry
    // is appended to the timeline instead.
    await logActivity(existing.id, `Submitted the form on ${lead.lead_source} again.\n${notes}`);
    return { id: existing.id, created: false };
  }

  const row: Record<string, unknown> = {
    email: lead.email,
    phone: lead.phone,
    full_name: lead.full_name,
    source: LOCAL_LEAD_SOURCE,
    status: 'new',
    notes,
    last_contacted_at: null,
  };
  const extra = {
    lead_source: lead.lead_source,
    interest: lead.interest,
    goal: lead.goal,
    tracking_phone: lead.tracking_phone || null,
    meta: lead.meta,
  };

  let result = await db.from('leads').insert({ ...row, ...extra }).select('id').single();
  if (result.error && missingIntakeColumns(result.error)) {
    result = await db.from('leads').insert(row).select('id').single();
  }
  if (result.error || !result.data) return { failed: result.error?.message ?? 'Lead could not be saved.' };

  await logActivity(result.data.id, `Lead captured from ${lead.lead_source}.\n${notes}`);
  return { id: result.data.id, created: true };
}

/**
 * The same person within the dedupe window, matched on email first and phone
 * second. Two queries rather than one `or()`: a phone number containing
 * brackets would break PostgREST's filter syntax.
 */
async function findRecent(lead: LeadIntakeInput): Promise<{ id: string | null } | { failed: string }> {
  const db = getSupabaseAdmin();
  const since = dedupeSince();

  const byEmail = await db
    .from('leads')
    .select('id')
    .ilike('email', lead.email)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byEmail.error) return { failed: byEmail.error.message };
  if (byEmail.data?.id) return { id: byEmail.data.id };

  const byPhone = await db
    .from('leads')
    .select('id')
    .eq('phone', lead.phone)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPhone.error) return { failed: byPhone.error.message };
  return { id: byPhone.data?.id ?? null };
}

/** Best effort: a failed timeline entry must not fail a captured lead. */
async function logActivity(leadId: string, bodyText: string) {
  const { error } = await getSupabaseAdmin().from('crm_activity').insert({
    subject_type: 'lead',
    subject_id: leadId,
    activity: 'note',
    body: bodyText,
    actor: 'Lead form',
  });
  if (error) console.warn('[lead-intake] activity log failed:', error.message);
}
