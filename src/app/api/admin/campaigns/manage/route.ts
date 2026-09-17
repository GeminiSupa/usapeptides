import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable, features } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, created, badRequest, notFound, serverError, readJson, clip, isEmail } from '@/lib/api';
import { AUDIENCES, AUDIENCE_FILTERS, sanitizeDesign } from '@/lib/emailDesign';

export const dynamic = 'force-dynamic';

/**
 * Campaigns: list, one report, create, edit, duplicate, delete.
 *
 *   GET    /api/admin/campaigns/manage            every email campaign with its numbers
 *   GET    /api/admin/campaigns/manage?id=        one campaign, its recipients and clicked links
 *   POST   { name, ... }                          new draft
 *   POST   { action: 'duplicate', id }            copy as a new draft
 *   PATCH  { id, ...fields }                      edit a draft
 *   DELETE ?id=                                   delete (not while it is sending)
 */

const LIST = 'id, name, subject, preview_text, status, audience, audience_filter, scheduled_at, started_at, completed_at, recipient_count, sent_count, failed_count, open_count, click_count, unsubscribe_count, last_test_at, created_at, updated_at';
const FULL = `${LIST}, from_name, reply_to, design`;
const AUDIENCE_IDS = new Set<string>(AUDIENCES.map((a) => a.id));
const FILTER_IDS = new Set<string>(AUDIENCE_FILTERS.map((f) => f.id));

const needsMigration = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === '42703' || e.code === 'PGRST204' || e.code === '42P01' || e.code === 'PGRST205' || /column|schema cache|does not exist/i.test(e.message ?? '')));
const MIGRATION = 'Campaigns need a database update. Run supabase/migrations/0017_campaigns.sql in the Supabase SQL editor, then reload.';

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'campaigns' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

function clean(body: Record<string, unknown>, partial: boolean) {
  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {};
  const has = (k: string) => !partial || k in body;
  if (has('name')) {
    const name = clip(body.name, 160);
    if (!name) fields.name = 'Give the campaign a name.'; else row.name = name;
  }
  if (has('subject')) row.subject = clip(body.subject, 200);
  if (has('preview_text')) row.preview_text = clip(body.preview_text, 200);
  if (has('from_name')) row.from_name = clip(body.from_name, 80) || null;
  if (has('reply_to')) {
    const v = clip(body.reply_to, 200);
    if (v && !isEmail(v)) fields.reply_to = 'That is not an email address.'; else row.reply_to = v || null;
  }
  if (has('design')) row.design = sanitizeDesign(body.design);
  if (has('audience')) row.audience = AUDIENCE_IDS.has(String(body.audience)) ? String(body.audience) : 'subscribers';
  if (has('audience_filter')) row.audience_filter = FILTER_IDS.has(String(body.audience_filter)) ? String(body.audience_filter) : 'none';
  return { row, fields };
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const id = new URL(req.url).searchParams.get('id');

  if (!id) {
    const { data, error } = await db.from('campaigns').select(LIST).eq('channel', 'email').order('created_at', { ascending: false }).limit(500);
    if (error) return needsMigration(error) ? ok({ campaigns: [], ready: false, notice: MIGRATION, emailReady: features.email }) : serverError(error.message);
    return ok({ campaigns: data ?? [], ready: true, notice: null, emailReady: features.email });
  }

  const { data: campaign, error } = await db.from('campaigns').select(FULL).eq('id', id).maybeSingle();
  if (error) return serverError(needsMigration(error) ? MIGRATION : error.message);
  if (!campaign) return notFound('That campaign no longer exists.');

  const { data: recipients } = await db.from('campaign_recipients')
    .select('id, email, name, source, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at')
    .eq('campaign_id', id).order('email').limit(5000);

  const { data: clicks } = await db.from('campaign_events').select('detail').eq('campaign_id', id).eq('event', 'click').limit(20000);
  const links = new Map<string, number>();
  for (const c of clicks ?? []) {
    const url = String(c.detail ?? '').replace(/[?&]utm_[^&]+/g, '').replace(/\?$/, '');
    links.set(url, (links.get(url) ?? 0) + 1);
  }

  return ok({
    campaign,
    recipients: recipients ?? [],
    links: Array.from(links, ([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count).slice(0, 25),
    emailReady: features.email,
  });
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Send JSON.');

  if (body.action === 'duplicate') {
    const { data: src, error } = await db.from('campaigns').select(FULL).eq('id', String(body.id)).maybeSingle();
    if (error) return serverError(needsMigration(error) ? MIGRATION : error.message);
    if (!src) return notFound('That campaign no longer exists.');
    const s = src as unknown as Record<string, unknown>;
    const { data, error: insertError } = await db.from('campaigns').insert({
      name: `${s.name} (copy)`.slice(0, 160), channel: 'email', subject: s.subject, preview_text: s.preview_text,
      from_name: s.from_name, reply_to: s.reply_to, design: s.design, audience: s.audience, audience_filter: s.audience_filter,
      status: 'draft', created_by: access.auth.admin.id,
    }).select(LIST).single();
    if (insertError) return serverError(insertError.message);
    return created({ campaign: data });
  }

  const { row, fields } = clean(body, false);
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);
  const { data, error } = await db.from('campaigns')
    .insert({ ...row, channel: 'email', status: 'draft', created_by: access.auth.admin.id })
    .select(FULL).single();
  if (error) return serverError(needsMigration(error) ? MIGRATION : error.message);
  return created({ campaign: data });
}

export async function PATCH(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body?.id) return badRequest('Which campaign?');
  const { row, fields } = clean(body, true);
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);
  if (!Object.keys(row).length) return badRequest('Nothing to save.');

  const db = getSupabaseAdmin();
  const { data: current } = await db.from('campaigns').select('status').eq('id', String(body.id)).maybeSingle();
  if (!current) return notFound('That campaign no longer exists.');
  // Once people have received it, the content is history. Duplicate it instead.
  if (['sending', 'sent'].includes(current.status)) return badRequest('This campaign has been sent. Duplicate it to make changes.');

  const { data, error } = await db.from('campaigns').update(row).eq('id', String(body.id)).select(FULL).maybeSingle();
  if (error) return serverError(needsMigration(error) ? MIGRATION : error.message);
  return ok({ campaign: data });
}

export async function DELETE(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('Which campaign?');
  const db = getSupabaseAdmin();
  const { data: current } = await db.from('campaigns').select('name, status').eq('id', id).maybeSingle();
  if (!current) return notFound('That campaign no longer exists.');
  if (current.status === 'sending') return badRequest('Pause the campaign before deleting it.');
  const { error } = await db.from('campaigns').delete().eq('id', id);
  if (error) return serverError(error.message);
  await writeAudit(access.auth.admin, { action: 'campaign.delete', targetType: 'campaign', targetId: id, targetLabel: current.name });
  return ok({ deleted: true });
}
