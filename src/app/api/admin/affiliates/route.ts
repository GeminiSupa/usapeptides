import { randomInt } from 'node:crypto';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit, diffOf } from '@/lib/audit';
import { parseRate } from '@/lib/permissions';
import { ok, created, badRequest, notFound, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Affiliates: outside partners who earn commission on orders they refer.
 *
 * Distinct from sub-users, who are internal and have dashboard logins. An
 * affiliate has no login at all — only a referral code — which is why this is
 * the least dangerous of the three Users tabs and needs the `affiliates`
 * permission rather than the owner role.
 *
 *   GET    /api/admin/affiliates
 *   POST   /api/admin/affiliates
 *   PATCH  /api/admin/affiliates    { id, changes }
 *   DELETE /api/admin/affiliates?id=
 */

const SELECT =
  'id, email, full_name, company, phone, referral_code, commission_rate,' +
  ' payout_method, payout_detail, notes, is_active, managed_by, created_at';

/**
 * supabase-js cannot infer a row type when the select list is built by
 * concatenation, so it falls back to an error-ish union. Casting to this at the
 * point of use keeps the handlers honestly typed.
 */
interface AffiliateRow {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  referral_code: string;
  commission_rate: number;
  payout_method: string | null;
  payout_detail: string | null;
  notes: string | null;
  is_active: boolean;
}

const SETUP_MESSAGE =
  'Affiliates need a database update that has not been run yet. Open the Supabase ' +
  'SQL editor, run supabase/migrations/0005_users.sql, then reload.';

const needsMigration = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  return (
    error.code === '42703' || error.code === 'PGRST204' || error.code === '42P01' ||
    /column .* does not exist|could not find the .* column|schema cache/i.test(error.message ?? '')
  );
};

/**
 * Referral codes.
 *
 * `crypto.randomInt`, not `Math.random`: a code is money, and a sequential or
 * predictable one lets somebody guess a working link and attribute their own
 * orders to a partner who never referred them.
 *
 * The alphabet leaves out O/0, I/1 and L, because these get read aloud and
 * typed off packaging, and a code nobody can transcribe generates support mail
 * rather than sales.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * A code that is not already taken. Compared in upper case because the unique
 * index is on `upper(referral_code)` — a link is typed in whatever case the
 * customer feels like.
 */
async function uniqueCode(db: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomCode();
    const { data, error } = await db
      .from('affiliates')
      .select('id')
      .ilike('referral_code', candidate)
      .maybeSingle();

    if (error && !needsMigration(error)) return null;
    if (!data) return candidate;
  }
  // 31^8 is about 850 billion, so eight collisions means something is wrong
  // rather than unlucky. Better to fail loudly than loop.
  return null;
}

/** A code an owner typed in themselves still has to be usable as a link. */
function normalizeSuppliedCode(value: unknown): string | null {
  const raw = clip(value, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (raw.length < 4 || raw.length > 32) return null;
  return raw;
}

/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  try {
    const db = getSupabaseAdmin();

    let query = db.from('affiliates').select(SELECT).order('created_at', { ascending: false });
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,referral_code.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);

    const affiliates = data ?? [];

    // Commission totals per affiliate, so the list answers "what do we owe?"
    // without a click each. One query rather than one per row.
    const { data: commissions } = await db
      .from('affiliate_commissions')
      .select('affiliate_id, amount, status');

    const totals: Record<string, { pending: number; approved: number; paid: number }> = {};
    for (const c of commissions ?? []) {
      const key = String(c.affiliate_id);
      totals[key] ??= { pending: 0, approved: 0, paid: 0 };
      const amount = Number(c.amount) || 0;
      if (c.status === 'pending') totals[key].pending += amount;
      else if (c.status === 'approved') totals[key].approved += amount;
      else if (c.status === 'paid') totals[key].paid += amount;
    }

    return ok({
      affiliates,
      totals,
      codeLength: CODE_LENGTH,
      canEdit: auth.admin.profile.is_superadmin || auth.admin.profile.permissions.includes('affiliates'),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const email = clip(body.email, 200).toLowerCase();
  const fullName = clip(body.full_name, 120);

  const fields: Record<string, string> = {};
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  if (!fullName) fields.full_name = 'A name is required.';

  const rate = body.commission_rate === undefined || body.commission_rate === ''
    ? 10
    : parseRate(body.commission_rate);
  if (rate === null) fields.commission_rate = 'Use a percentage between 0 and 100.';

  const db = getSupabaseAdmin();

  // A code may be supplied, but is generated when left blank — which is the
  // path anyone sensible takes.
  let code: string | null;
  if (clip(body.referral_code, 40)) {
    code = normalizeSuppliedCode(body.referral_code);
    if (!code) {
      fields.referral_code = 'Use 4 to 32 letters, numbers or dashes, or leave it blank.';
    } else {
      const { data: clash } = await db
        .from('affiliates')
        .select('id')
        .ilike('referral_code', code)
        .maybeSingle();
      if (clash) fields.referral_code = 'That code is already in use.';
    }
  } else {
    code = await uniqueCode(db);
    if (!code) return serverError('Could not generate a referral code. Try again.');
  }

  if (Object.keys(fields).length) return badRequest('Could not add that affiliate.', fields);

  try {
    const insertResult = await db
      .from('affiliates')
      .insert({
        email,
        full_name: fullName,
        company: clip(body.company, 160) || null,
        phone: clip(body.phone, 40) || null,
        referral_code: code,
        commission_rate: rate,
        payout_method: clip(body.payout_method, 40) || null,
        payout_detail: clip(body.payout_detail, 300) || null,
        notes: clip(body.notes, 2000) || null,
        is_active: body.is_active !== false,
        managed_by: auth.admin.id,
      })
      .select(SELECT)
      .single();

    const data = insertResult.data as unknown as AffiliateRow | null;
    const error = insertResult.error;

    if (error) {
      if (error.code === '23505') {
        return badRequest('Could not add that affiliate.', {
          email: 'That address or code is already registered.',
        });
      }
      return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);
    }

    await writeAudit(auth.admin, {
      action: 'affiliate.create',
      targetType: 'affiliate',
      targetId: data!.id,
      targetLabel: email,
      detail: { referral_code: code, commission_rate: rate },
    });

    return created({ affiliate: data! });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

const WRITABLE: Record<string, (v: unknown) => unknown> = {
  full_name: (v) => clip(v, 120) || null,
  company: (v) => clip(v, 160) || null,
  phone: (v) => clip(v, 40) || null,
  commission_rate: (v) => parseRate(v),
  payout_method: (v) => clip(v, 40) || null,
  payout_detail: (v) => clip(v, 300) || null,
  notes: (v) => clip(v, 2000) || null,
  is_active: (v) => Boolean(v),
};

export async function PATCH(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; changes?: Record<string, unknown>; regenerateCode?: boolean }>(req);
  if (!body?.id) return badRequest('An "id" is required.');

  const db = getSupabaseAdmin();

  const found = await db.from('affiliates').select(SELECT).eq('id', body.id).maybeSingle();
  if (found.error) return serverError(needsMigration(found.error) ? SETUP_MESSAGE : found.error.message);

  const target = found.data as unknown as AffiliateRow | null;
  if (!target) return notFound('No such affiliate.');

  const changes: Record<string, unknown> = {};
  const fields: Record<string, string> = {};

  for (const [key, raw] of Object.entries(body.changes ?? {})) {
    const clean = WRITABLE[key];
    if (!clean) continue;
    const value = clean(raw);
    if (value === null && key === 'commission_rate') {
      fields.commission_rate = 'Use a percentage between 0 and 100.';
      continue;
    }
    changes[key] = value;
  }

  // The code is replaced, never edited: a half-typed code is a dead link, and
  // the old one keeps working for anybody who already has it until it changes.
  if (body.regenerateCode) {
    const next = await uniqueCode(db);
    if (!next) return serverError('Could not generate a new code. Try again.');
    changes.referral_code = next;
  }

  if (Object.keys(fields).length) return badRequest('Could not save.', fields);
  if (Object.keys(changes).length === 0) return badRequest('Nothing to change.');

  try {
    const { data, error } = await db
      .from('affiliates')
      .update(changes)
      .eq('id', target.id)
      .select(SELECT)
      .maybeSingle();

    if (error) return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);
    if (!data) return notFound('No such affiliate.');

    await writeAudit(auth.admin, {
      action: body.regenerateCode ? 'affiliate.code_regenerate' : 'affiliate.update',
      targetType: 'affiliate',
      targetId: target.id,
      targetLabel: target.email,
      detail: diffOf(target as unknown as Record<string, unknown>, changes),
    });

    return ok({ affiliate: data });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

export async function DELETE(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('An "id" is required.');

  const db = getSupabaseAdmin();

  const found = await db.from('affiliates').select('id, email, referral_code').eq('id', id).maybeSingle();
  const target = found.data as unknown as Pick<AffiliateRow, 'id' | 'email' | 'referral_code'> | null;
  if (!target) return notFound('No such affiliate.');

  // Commissions cascade with the affiliate, so money that has been paid would
  // vanish from the record. Deactivating keeps the history and stops the link.
  const { data: settled } = await db
    .from('affiliate_commissions')
    .select('id')
    .eq('affiliate_id', id)
    .in('status', ['approved', 'paid'])
    .limit(1);

  if (settled && settled.length > 0) {
    return badRequest(
      'This affiliate has approved or paid commission against them, which would be ' +
      'deleted with them. Switch them off instead — their link stops working and the ' +
      'payment record survives.'
    );
  }

  try {
    const { error } = await db.from('affiliates').delete().eq('id', id);
    if (error) return serverError(error.message);

    await writeAudit(auth.admin, {
      action: 'affiliate.delete',
      targetType: 'affiliate',
      targetId: id,
      targetLabel: target.email,
      detail: { referral_code: target.referral_code },
    });

    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
