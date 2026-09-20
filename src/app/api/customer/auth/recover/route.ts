import { ok, readJson } from '@/lib/api';
import {
  customerAuthLink,
  customerAuthRateLimited,
  customerPageLink,
  sendCustomerAuthEmail,
  type CustomerNoticeKind,
} from '@/lib/customerAuthEmail';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail, normaliseEmail } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** The same reply for every address, so the form cannot be used to find accounts. */
const GENERIC = { sent: true };

/** Explain the outcome to the mailbox owner, who is the only one who can read it. */
async function notice(req: Request, email: string, kind: CustomerNoticeKind) {
  await sendCustomerAuthEmail({
    to: email,
    kind,
    url: customerPageLink(req, kind === 'staff-account' ? '/admin' : '/my-account'),
  }).catch(() => undefined);
  return ok(GENERIC);
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase') || featureUnavailable('email');
  if (unavailable) return unavailable;
  const body = await readJson<{ email?: unknown }>(req);
  const email = normaliseEmail(body?.email);
  if (!isEmail(email)) return ok(GENERIC);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await customerAuthRateLimited('recovery', email, ip)) {
    return Response.json({ error: 'rate_limited', message: 'Too many requests. Please wait ten minutes before trying again.' }, { status: 429 });
  }

  const db = getSupabaseAdmin();
  const { data: profile, error: profileError } = await db.from('customer_profiles').select('id, user_id').eq('email', email).maybeSingle();
  const { data: staff, error: staffError } = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (profileError || staffError) return Response.json({ message: 'Password reset is temporarily unavailable. Please try again.' }, { status: 503 });

  // Dashboard logins reset their password through the dashboard, not here.
  if (staff) return notice(req, email, 'staff-account');
  if (!profile?.user_id) return notice(req, email, 'no-account');

  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
  if (error) return ok(GENERIC);
  await sendCustomerAuthEmail({
    to: email,
    kind: 'recovery',
    url: customerAuthLink(req, data.properties.hashed_token, 'recovery'),
  }).catch(() => undefined);
  return ok(GENERIC);
}
