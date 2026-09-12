import { createHmac } from 'node:crypto';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { chatwootEnv, features } from '@/lib/env';
import { ok, badRequest, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Signed identity for a customer opening the live chat.
 *
 * Chatwoot can be set to reject a `setUser` call unless the identifier comes
 * with an HMAC of itself, keyed on the inbox's HMAC secret. That stops a
 * visitor opening the widget and claiming to be somebody else's account, which
 * would show them that person's chat history.
 *
 * The signing has to happen here because the secret must never ship to the
 * browser. The browser sends its Supabase session; this route decides who that
 * is, and returns only that person's own signed identity.
 *
 *   POST /api/chat/identity   Authorization: Bearer <supabase access token>
 *   -> { identifier, identifierHash, email, name }
 */

export async function POST(req: Request) {
  if (!features.liveChat) {
    return ok({ configured: false });
  }

  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return badRequest('Sign in first.');

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data?.user?.email) return badRequest('That session is not valid.');

    const user = data.user;

    // The user id, not the email: an email can be changed, and the identifier
    // is what ties a Chatwoot contact to its conversation history.
    const identifier = user.id;

    const identifierHash = chatwootEnv.hmacSecret
      ? createHmac('sha256', chatwootEnv.hmacSecret).update(identifier).digest('hex')
      : undefined;

    // Pulled from our own profile row rather than trusted from the client, so
    // the name shown to an agent is the one on the account.
    const { data: profile } = await getSupabaseAdmin()
      .from('customer_profiles')
      .select('full_name, institution, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    return ok({
      configured: true,
      identifier,
      identifierHash,
      email: user.email,
      name: profile?.full_name || user.email,
      institution: profile?.institution ?? null,
      phone: profile?.phone ?? null,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
