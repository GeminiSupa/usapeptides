import { badRequest, ok, readJson, serverError } from '@/lib/api';
import {
  customerAuthLink,
  customerAuthRateLimited,
  customerPageLink,
  sendCustomerAuthEmail,
  type CustomerNoticeKind,
} from '@/lib/customerAuthEmail';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cleanText, isEmail, isPhone, isPersonName, normaliseEmail, passwordProblem } from '@/lib/validate';

export const dynamic = 'force-dynamic';

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

/**
 * Every visitor gets this one reply, so the form never reveals which addresses
 * already exist. Whatever the real outcome was, an email explaining it goes to
 * the address itself — only the mailbox owner sees that.
 */
const GENERIC =
  'If this address can be registered, a verification email has been sent. Existing customers can sign in or reset their password.';

/**
 * Tell the mailbox owner why no account was created.
 *
 * Without this the route answered "a verification email has been sent" and
 * sent nothing, so a staff address or an existing customer waited forever for
 * an email that was never going to arrive. That is exactly what happened to
 * the owner's own two addresses.
 */
async function sendNotice(req: Request, email: string, kind: CustomerNoticeKind) {
  try {
    await sendCustomerAuthEmail({
      to: email,
      kind,
      url: customerPageLink(req, kind === 'staff-account' ? '/admin' : '/my-account'),
    });
  } catch {
    // Never surface a send failure here: it would reveal that the address matched.
  }
  return ok({ sent: true, message: GENERIC });
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase') || featureUnavailable('email');
  if (unavailable) return unavailable;

  const body = await readJson<{ email?: unknown; password?: unknown; fullName?: unknown; phone?: unknown; marketingOptIn?: unknown }>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = cleanText(body.fullName, 160);
  const phone = cleanText(body.phone, 50);

  const fields: Record<string, string> = {};
  if (!isEmail(email)) fields.email = 'Enter a valid email address.';
  if (!isPersonName(fullName)) fields.fullName = 'Enter your full name.';
  const passwordIssue = passwordProblem(password, email);
  if (passwordIssue) fields.password = passwordIssue;
  if (phone && !isPhone(phone)) fields.phone = 'Enter a valid phone number, or leave it blank.';
  if (Object.keys(fields).length) {
    return badRequest(Object.values(fields)[0], fields);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (await customerAuthRateLimited('signup', email, ip)) {
    return Response.json({ error: 'rate_limited', message: 'Too many requests. Please wait ten minutes before trying again.' }, { status: 429 });
  }

  const db = getSupabaseAdmin();
  const { data: staff, error: staffError } = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (staffError) return serverError('Account registration is temporarily unavailable. Please try again.');
  // A dashboard login and a customer account may not share an address.
  if (staff) return sendNotice(req, email, 'staff-account');

  const { data: profile, error: profileError } = await db
    .from('customer_profiles').select('id, user_id').eq('email', email).maybeSingle();
  if (profileError) return serverError('Could not process this account request. Please try again.');
  if (profile?.user_id) return sendNotice(req, email, 'already-registered');

  try {
    const existing = await findUser(email);
    if (existing?.email_confirmed_at) return sendNotice(req, email, 'already-registered');

    const { data, error } = await db.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { data: { full_name: fullName, phone, marketing_opt_in: body.marketingOptIn === true, kind: 'customer' } },
    });
    if (error) throw error;

    await sendCustomerAuthEmail({
      to: email,
      kind: 'signup',
      url: customerAuthLink(req, data.properties.hashed_token, 'signup'),
    });

    return ok({ sent: true, message: GENERIC });
  } catch {
    return serverError('Could not create the account. Please try again.');
  }
}
