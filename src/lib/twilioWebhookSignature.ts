import 'server-only';

import twilio from 'twilio';

import { twilioEnv } from './env';

/**
 * Proves that a webhook request really came from Twilio.
 *
 * The voice webhook has no session and no login — Twilio calls it server to
 * server, so anyone who learns the URL can post to it. What stops them is
 * that Twilio signs every request with the account's auth token, and only
 * Twilio and this server know it.
 *
 * Two details decide whether verification works at all:
 *
 *   THE URL MUST BE THE PUBLIC ONE. Twilio signs the address it was
 *   configured with. Behind Vercel's proxy the request arrives claiming a
 *   different host, so the signed URL has to be rebuilt from the forwarded
 *   headers, and the scheme forced back to https — the proxy speaks http to
 *   the function, and signing `http://...` against an `https://...` signature
 *   fails every time, silently and identically to a forged request.
 *
 *   THE PARAMS MUST BE THE FORM BODY. Twilio sorts the POST fields by name
 *   and concatenates name+value onto the URL before signing. Nothing else
 *   goes in: not headers, not the query string of a POST.
 */

/** Verification is mandatory in production and optional elsewhere. */
export const signatureRequired = (): boolean => process.env.NODE_ENV === 'production';

/**
 * The address Twilio signed, rebuilt from what reached us.
 *
 * `x-forwarded-host` is set by the proxy and is the name the caller used.
 * `host` is the fallback for a direct request, which in practice means local
 * development.
 */
export function publicUrlOf(req: Request): string {
  const url = new URL(req.url);

  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host') || url.host;

  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const protocol = isLocal ? (forwardedProto || url.protocol.replace(':', '') || 'http') : 'https';

  // Query string included: Twilio signs the full address it was given, and a
  // webhook URL configured with `?x=1` is signed with it.
  return `${protocol}://${host}${url.pathname}${url.search}`;
}

export type SignatureResult =
  | { ok: true; reason: 'valid' | 'not-required' }
  | { ok: false; reason: 'missing-signature' | 'invalid-signature' | 'no-auth-token' };

/**
 * Checks `X-Twilio-Signature` against the form body.
 *
 * Outside production an unsigned request is allowed through, because the
 * alternative is that the webhook cannot be exercised locally at all. The
 * result says which branch was taken so the caller can log it.
 */
export function verifyTwilioSignature(
  req: Request,
  params: Record<string, string>
): SignatureResult {
  const required = signatureRequired();
  const signature = req.headers.get('x-twilio-signature');

  if (!twilioEnv.authToken) {
    // Without the token nothing can be verified. In production that is a
    // refusal, not a pass: an unverifiable endpoint is an open one.
    return required ? { ok: false, reason: 'no-auth-token' } : { ok: true, reason: 'not-required' };
  }

  if (!signature) {
    return required ? { ok: false, reason: 'missing-signature' } : { ok: true, reason: 'not-required' };
  }

  const valid = twilio.validateRequest(
    twilioEnv.authToken,
    signature,
    publicUrlOf(req),
    params
  );

  if (valid) return { ok: true, reason: 'valid' };

  // A bad signature is refused everywhere. Allowing it outside production
  // would mean the local behaviour differs from the deployed one in exactly
  // the case that matters.
  return { ok: false, reason: 'invalid-signature' };
}

/** Reads an `application/x-www-form-urlencoded` body into a plain object. */
export async function readFormParams(req: Request): Promise<Record<string, string>> {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    // forEach rather than for..of: the project targets ES5 lib settings, and
    // iterating FormData's entries needs downlevelIteration.
    form.forEach((value, key) => {
      if (typeof value === 'string') params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}
