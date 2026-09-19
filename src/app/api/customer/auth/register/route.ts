import { badRequest, isEmail, ok, readJson, serverError } from '@/lib/api';
import { customerAuthLink, customerAuthRateLimited, sendCustomerAuthEmail } from '@/lib/customerAuthEmail';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD = 12;

async function findUser(email: string) {
  const db = getSupabaseAdmin();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user ?? null;
  }
  return null;
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase') || featureUnavailable('email');
  if (unavailable) return unavailable;

  const body = await readJson<{ email?: string; password?: string; fullName?: string; phone?: string; marketingOptIn?: boolean }>(req);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const fullName = String(body?.fullName ?? '').trim().slice(0, 160);
  const phone = String(body?.phone ?? '').trim().slice(0, 50);
  if (!isEmail(email)) return badRequest('Enter a valid email address.');
  if (fullName.length < 2) return badRequest('Enter your name.');
  if (password.length < MIN_PASSWORD) return badRequest(`Use at least ${MIN_PASSWORD} characters for your password.`);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await customerAuthRateLimited('signup', email, ip)) {
    return Response.json({ error: 'rate_limited', message: 'Too many requests. Please wait ten minutes before trying again.' }, { status: 429 });
  }

  const db = getSupabaseAdmin();
  const { data: staff, error: staffError } = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (staffError) return serverError('Account registration is temporarily unavailable. Please try again.');
  const generic = 'If this address can be registered, a verification email has been sent. Existing customers can sign in or reset their password.';
  if (staff) return ok({ sent: true, message: generic });

  const { data: profile, error: profileError } = await db
    .from('customer_profiles').select('id, user_id').eq('email', email).maybeSingle();
  if (profileError) return serverError('Could not process this account request. Please try again.');
  if (profile?.user_id) return ok({ sent: true, message: generic });

  try {
    const existing = await findUser(email);
    if (existing?.email_confirmed_at) {
      return ok({ sent: true, message: generic });
    }

    const { data, error } = await db.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { data: { full_name: fullName, phone, marketing_opt_in: Boolean(body?.marketingOptIn), kind: 'customer' } },
    });
    if (error) throw error;

    try {
      await sendCustomerAuthEmail({
        to: email,
        kind: 'signup',
        url: customerAuthLink(req, data.properties.hashed_token, 'signup'),
      });
    } catch (emailError) {
      throw emailError;
    }

    return ok({ sent: true, message: generic });
  } catch {
    return serverError('Could not create the account. Please try again.');
  }
}
