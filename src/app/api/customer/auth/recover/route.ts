import { isEmail, ok, readJson } from '@/lib/api';
import { customerAuthLink, customerAuthRateLimited, sendCustomerAuthEmail } from '@/lib/customerAuthEmail';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase') || featureUnavailable('email');
  if (unavailable) return unavailable;
  const body = await readJson<{ email?: string }>(req);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) return ok({ sent: true });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await customerAuthRateLimited('recovery', email, ip)) {
    return Response.json({ error: 'rate_limited', message: 'Too many requests. Please wait ten minutes before trying again.' }, { status: 429 });
  }

  const db = getSupabaseAdmin();
  const { data: profile, error: profileError } = await db.from('customer_profiles').select('id, user_id').eq('email', email).maybeSingle();
  const { data: staff, error: staffError } = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (profileError || staffError) return Response.json({ message: 'Password reset is temporarily unavailable. Please try again.' }, { status: 503 });
  if (!profile?.user_id || staff) return ok({ sent: true });

  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
  if (!error) {
    await sendCustomerAuthEmail({
      to: email,
      kind: 'recovery',
      url: customerAuthLink(req, data.properties.hashed_token, 'recovery'),
    }).catch(() => undefined);
  }
  // The same response prevents disclosing whether an address has an account.
  return ok({ sent: true });
}
