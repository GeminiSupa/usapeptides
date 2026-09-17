import { requireAdmin, type AdminIdentity } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { isCreditable } from '@/lib/attribution';
import { ok, created, badRequest, notFound, serverError, readJson, clip, isEmail } from '@/lib/api';
import { STAGE_IDS, normalizeUrl, osmLink, scorePlace, stageLabel } from '@/lib/prospector';

export const dynamic = 'force-dynamic';

/**
 * The Prospector's saved businesses.
 *
 *   GET    /api/admin/prospects/pipeline               saved prospects + team list
 *   GET    /api/admin/prospects/pipeline?activity=<id> one prospect's timeline
 *   POST   { places: [...] }                           save search results / an import
 *   POST   { action: 'note', id, body, kind? }         add to the timeline
 *   POST   { action: 'lead', id }                      copy into Leads
 *   PATCH  { id, changes }                             stage, owner, notes, follow-up…
 *   DELETE ?id=  or  ?ids=a,b,c                        remove
 *
 * Works on a database without 0016: the extra map columns are dropped and the
 * screen says what to run.
 */

const BASE = 'id, company, contact_name, email, phone, website, segment, stage, owner, next_action, next_action_at, created_at, updated_at';
const EXTRA = 'source_provider, source_external_id, category, formatted_address, city, region, country, latitude, longitude, map_url, whatsapp, fit_score, fit_reasons, notes, tags, owner_id, last_contacted_at, lead_id';
const EXTRA_KEYS = EXTRA.split(',').map((k) => k.trim());

const missingColumn = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message ?? '')));

const stripExtra = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !EXTRA_KEYS.includes(k)));

const MIGRATION = 'Run supabase/migrations/0016_prospector.sql to keep map location, score, notes and owner.';

type Db = ReturnType<typeof getSupabaseAdmin>;

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'prospects' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

async function logActivity(db: Db, admin: AdminIdentity, id: string, activity: string, body: string) {
  await db.from('crm_activity').insert({
    subject_type: 'prospect', subject_id: id, activity, body: body.slice(0, 5000), actor: admin.profile.full_name || admin.email,
  });
}

/** One place from a search or a spreadsheet row, validated. */
function cleanPlace(input: Record<string, unknown>) {
  const company = clip(input.company ?? input.name ?? input.organization_name, 240);
  if (!company) return null;
  const lat = Number(input.latitude);
  const lon = Number(input.longitude);
  const latitude = Number.isFinite(lat) && Math.abs(lat) <= 90 && input.latitude !== '' && input.latitude != null ? lat : null;
  const longitude = Number.isFinite(lon) && Math.abs(lon) <= 180 && input.longitude !== '' && input.longitude != null ? lon : null;
  const email = clip(input.email, 240).toLowerCase();
  const row: Record<string, unknown> = {
    company,
    contact_name: clip(input.contact_name, 160) || null,
    email: email && isEmail(email) ? email : null,
    phone: clip(input.phone, 80) || null,
    website: normalizeUrl(input.website),
    segment: clip(input.segment ?? input.category, 160) || null,
    stage: STAGE_IDS.has(String(input.stage)) ? String(input.stage) : 'identified',
    source_provider: clip(input.source_provider, 40) || 'manual',
    source_external_id: clip(input.source_external_id, 255) || null,
    category: clip(input.category, 160) || null,
    formatted_address: clip(input.formatted_address ?? input.address, 500) || null,
    city: clip(input.city, 140) || null,
    region: clip(input.region ?? input.state, 140) || null,
    country: clip(input.country, 140) || null,
    latitude,
    longitude,
    map_url: normalizeUrl(input.map_url) ?? osmLink(latitude, longitude),
    whatsapp: clip(input.whatsapp, 80) || null,
    notes: clip(input.notes, 5000) || null,
  };
  const scored = scorePlace({
    company, category: row.category as string, website: row.website as string, phone: row.phone as string,
    email: row.email as string, city: row.city as string, formatted_address: row.formatted_address as string,
  });
  const given = Number(input.fit_score);
  row.fit_score = Number.isFinite(given) && given >= 0 && given <= 100 ? Math.round(given) : scored.score;
  row.fit_reasons = Array.isArray(input.fit_reasons) ? input.fit_reasons.map((r) => clip(r, 80)).filter(Boolean).slice(0, 6) : scored.reasons;
  return row;
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const url = new URL(req.url);

  const activityFor = url.searchParams.get('activity');
  if (activityFor) {
    const { data, error } = await db.from('crm_activity').select('id, activity, body, actor, created_at')
      .eq('subject_type', 'prospect').eq('subject_id', activityFor).order('created_at', { ascending: false }).limit(100);
    if (error) return serverError(error.message);
    return ok({ activity: data ?? [] });
  }

  let ready = true;
  let result = await db.from('sales_prospects').select(`${BASE}, ${EXTRA}`).order('created_at', { ascending: false }).limit(2000);
  if (missingColumn(result.error)) {
    ready = false;
    result = await db.from('sales_prospects').select(BASE).order('created_at', { ascending: false }).limit(2000) as typeof result;
  }
  if (result.error) return serverError(result.error.message);

  const { data: people } = await db.from('admin_users').select('id, full_name, email, role, tier, status');
  const team = (people ?? []).filter((p: any) => p.status === 'active' && p.tier !== 'sub_user')
    .map((p: any) => ({ id: p.id as string, name: (p.full_name || p.email) as string, agent: isCreditable(p) }));

  return ok({ prospects: result.data ?? [], ready, notice: ready ? null : MIGRATION, team, you: access.auth.admin.id });
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const admin = access.auth.admin;
  const db = getSupabaseAdmin();
  const body = await readJson<Record<string, any>>(req);
  if (!body) return badRequest('Send JSON.');

  if (body.action === 'note') {
    const text = clip(body.body, 5000);
    if (!body.id || !text) return badRequest('Write a note first.');
    const kind = ['note', 'call', 'email', 'whatsapp', 'visit'].includes(body.kind) ? body.kind : 'note';
    await logActivity(db, admin, String(body.id), kind, text);
    if (kind !== 'note') {
      const upd = await db.from('sales_prospects').update({ last_contacted_at: new Date().toISOString() }).eq('id', body.id);
      if (upd.error && !missingColumn(upd.error)) return serverError(upd.error.message);
    }
    return created({ logged: true });
  }

  if (body.action === 'lead') {
    const { data: p, error } = await db.from('sales_prospects').select('*').eq('id', body.id).maybeSingle();
    if (error) return serverError(error.message);
    if (!p) return notFound('That prospect no longer exists.');
    if (p.lead_id) return badRequest('This prospect is already in Leads.');
    if (!('lead_id' in p)) {
      // Before 0016 there is nowhere to remember the link, so look for it.
      const { data: dup } = await db.from('leads').select('id').eq('source', 'prospector').eq('institution', p.company).limit(1);
      if (dup?.length) return badRequest('This prospect is already in Leads.');
    }
    const { data: lead, error: leadError } = await db.from('leads').insert({
      full_name: p.contact_name || null,
      institution: p.company,
      email: p.email || null,
      phone: p.phone || p.whatsapp || null,
      source: 'prospector',
      status: 'new',
      notes: [p.category, p.formatted_address, p.website, p.notes].filter(Boolean).join('\n'),
      ...(p.owner_id ? { owner_id: p.owner_id } : {}),
    }).select('id').single();
    if (leadError) return serverError(leadError.message);
    const upd = await db.from('sales_prospects').update({ lead_id: lead.id, stage: p.stage === 'identified' ? 'qualified' : p.stage }).eq('id', p.id);
    if (upd.error && !missingColumn(upd.error)) return serverError(upd.error.message);
    await logActivity(db, admin, p.id, 'status_change', 'Copied to Leads');
    return created({ leadId: lead.id });
  }

  // Save places
  const places = Array.isArray(body.places) ? body.places : [];
  if (!places.length) return badRequest('Nothing to save.');
  if (places.length > 2000) return badRequest('Save up to 2,000 at a time.');

  const rows = places.map((p: unknown) => (p && typeof p === 'object' ? cleanPlace(p as Record<string, unknown>) : null))
    .filter((r): r is Record<string, unknown> => Boolean(r));
  const skippedInvalid = places.length - rows.length;

  // Already saved? Match the map id first, then name + city.
  const { data: existing } = await db.from('sales_prospects').select('*').limit(5000);
  // Same business = same map id, or same name in the same city. A missing city
  // (older rows, or a database before 0016) matches any city.
  const ids = new Set<string>();
  const cities = new Map<string, Set<string>>();
  const remember = (company: unknown, city: unknown, id: unknown) => {
    if (id) ids.add(String(id));
    const name = String(company).trim().toLowerCase();
    if (!cities.has(name)) cities.set(name, new Set());
    cities.get(name)!.add(String(city ?? '').trim().toLowerCase());
  };
  const isKnown = (company: unknown, city: unknown, id: unknown) => {
    if (id && ids.has(String(id))) return true;
    const seen = cities.get(String(company).trim().toLowerCase());
    if (!seen) return false;
    const c = String(city ?? '').trim().toLowerCase();
    return seen.has('') || !c || seen.has(c);
  };
  for (const e of existing ?? []) remember(e.company, e.city, e.source_external_id);

  const fresh: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (isKnown(r.company, r.city, r.source_external_id)) continue;
    remember(r.company, r.city, r.source_external_id);
    if (body.ownerId) r.owner_id = String(body.ownerId);
    fresh.push(r);
  }

  let ready = true;
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    let { error, count } = await db.from('sales_prospects').insert(ready ? chunk : chunk.map(stripExtra), { count: 'exact' });
    if (missingColumn(error)) {
      ready = false;
      ({ error, count } = await db.from('sales_prospects').insert(chunk.map(stripExtra), { count: 'exact' }));
    }
    if (error) return serverError(error.message);
    inserted += count ?? chunk.length;
  }

  if (inserted) {
    await writeAudit(admin, { action: 'prospect.import', targetType: 'prospect', targetLabel: `${inserted} saved`, detail: { saved: inserted, duplicates: rows.length - fresh.length } });
  }
  return created({
    saved: inserted,
    duplicates: rows.length - fresh.length,
    invalid: skippedInvalid,
    notice: ready ? null : MIGRATION,
  });
}

const EDITABLE = new Set(['company', 'contact_name', 'email', 'phone', 'website', 'segment', 'stage', 'owner', 'next_action',
  'next_action_at', 'category', 'formatted_address', 'city', 'region', 'country', 'whatsapp', 'notes', 'tags', 'owner_id', 'fit_score']);

export async function PATCH(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const body = await readJson<{ id?: string; ids?: string[]; changes?: Record<string, unknown> }>(req);
  const ids = body?.ids?.length ? body.ids.map(String).slice(0, 2000) : body?.id ? [String(body.id)] : [];
  if (!ids.length || !body?.changes) return badRequest('Say which prospect and what to change.');

  const changes: Record<string, unknown> = {};
  const fields: Record<string, string> = {};
  for (const [key, raw] of Object.entries(body.changes)) {
    if (!EDITABLE.has(key)) continue;
    if (key === 'stage') {
      if (!STAGE_IDS.has(String(raw))) fields.stage = 'Unknown stage.'; else changes.stage = raw;
    } else if (key === 'email') {
      const v = clip(raw, 240).toLowerCase();
      if (v && !isEmail(v)) fields.email = 'That is not an email address.'; else changes.email = v || null;
    } else if (key === 'website') {
      changes.website = normalizeUrl(raw);
    } else if (key === 'next_action_at') {
      const d = raw ? new Date(String(raw)) : null;
      if (d && Number.isNaN(d.getTime())) fields.next_action_at = 'That date cannot be read.'; else changes.next_action_at = d ? d.toISOString() : null;
    } else if (key === 'owner_id') {
      changes.owner_id = raw ? String(raw) : null;
    } else if (key === 'tags') {
      changes.tags = (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map((t) => clip(t, 40)).filter(Boolean).slice(0, 20);
    } else if (key === 'fit_score') {
      const n = Number(raw);
      if (Number.isFinite(n)) changes.fit_score = Math.max(0, Math.min(100, Math.round(n)));
    } else {
      changes[key] = clip(raw, key === 'notes' ? 5000 : 500) || null;
    }
  }
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);
  if (!Object.keys(changes).length) return badRequest('Nothing to change.');
  if ('company' in changes && !changes.company) return badRequest('The business needs a name.', { company: 'Required.' });

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('sales_prospects').update(changes).in('id', ids).select('id');
  if (error) return serverError(missingColumn(error) ? MIGRATION : error.message);
  if (!data?.length) return notFound('Those prospects no longer exist.');

  if (changes.stage) {
    for (const id of ids.slice(0, 50)) await logActivity(db, access.auth.admin, id, 'status_change', `Stage: ${stageLabel(String(changes.stage))}`);
  }
  return ok({ updated: data.length });
}

export async function DELETE(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') ?? url.searchParams.get('id') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2000);
  if (!ids.length) return badRequest('Which prospects?');
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('sales_prospects').delete().in('id', ids).select('id, company');
  if (error) return serverError(error.message);
  await db.from('crm_activity').delete().eq('subject_type', 'prospect').in('subject_id', ids);
  await writeAudit(access.auth.admin, {
    action: 'prospect.delete', targetType: 'prospect',
    targetLabel: data?.length === 1 ? data[0].company : `${data?.length ?? 0} prospects`,
  });
  return ok({ deleted: data?.length ?? 0 });
}
