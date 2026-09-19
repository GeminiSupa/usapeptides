import 'server-only';

import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';
import { BUSINESS, features, resendEnv, smtpEnv, supabaseEnv } from './env';
import { getSupabaseAdmin } from './supabaseAdmin';

export type CustomerAuthEmailKind = 'signup' | 'recovery';

interface AuthEmailInput {
  to: string;
  kind: CustomerAuthEmailKind;
  url: string;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Send customer-security mail without exposing the Resend key to the browser. */
export async function sendCustomerAuthEmail({ to, kind, url }: AuthEmailInput) {
  if (!features.email) throw new Error('Email is not configured for this deployment.');

  const signup = kind === 'signup';
  const subject = signup ? `Verify your ${BUSINESS.name} account` : `Reset your ${BUSINESS.name} password`;
  const heading = signup ? 'Verify your email address' : 'Reset your password';
  const action = signup ? 'Verify email and open account' : 'Choose a new password';
  const explanation = signup
    ? 'Use the secure link below to finish creating your customer account.'
    : 'Use the secure link below to choose a new password. If you did not request this, you can ignore this email.';
  const support = `This is an automated email and replies are not monitored. For help, email ${BUSINESS.supportEmail} or call ${BUSINESS.supportPhone}.`;
  const html = `<!doctype html><html><body style="margin:0;background:#fdfbf0;color:#233049;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><h1 style="color:#1f4233;font-size:24px">${heading}</h1><p>${explanation}</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#1f4233;color:#fff;text-decoration:none;padding:14px 20px;font-weight:700">${action}</a></p><p style="font-size:13px;color:#596274">This link can be used once.</p><p style="font-size:13px;color:#596274">${support}</p></div></body></html>`;
  const text = `${heading}\n\n${explanation}\n\n${url}\n\nThis link can be used once.\n\n${support}`;
  const automatedSender = `${BUSINESS.name} - Do Not Reply`;

  if (resendEnv.apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendEnv.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `"${automatedSender}" <${resendEnv.from}>`,
        to: [to],
        subject,
        html,
        text,
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message || `Resend rejected the email (${response.status}).`);
    }
    return;
  }

  transport ??= nodemailer.createTransport({
    host: smtpEnv.host,
    port: smtpEnv.port,
    secure: smtpEnv.secure,
    auth: { user: smtpEnv.user, pass: smtpEnv.pass },
  });
  await transport.sendMail({
    from: `"${automatedSender}" <${smtpEnv.from}>`,
    to,
    subject,
    html,
    text,
  });
}

const attempts = new Map<string, number>();

/** Best-effort cooldown; Supabase and Resend also enforce provider limits. */
function fallbackRateLimited(key: string, cooldownMs = 60_000) {
  const now = Date.now();
  const last = attempts.get(key) ?? 0;
  if (now - last < cooldownMs) return true;
  attempts.set(key, now);
  if (attempts.size > 2_000) {
    attempts.forEach((at, candidate) => {
      if (now - at > cooldownMs * 2) attempts.delete(candidate);
    });
  }
  return false;
}

const digest = (value: string) => createHmac(
  'sha256',
  String(process.env.EMAIL_LINK_SECRET ?? '').trim() || supabaseEnv.serviceRoleKey,
).update(value).digest('hex');

/**
 * Durable rate limiting on Vercel. Migration 0021 provides an atomic database
 * function; the in-memory fallback keeps older deployments working until the
 * owner runs the migration.
 */
export async function customerAuthRateLimited(kind: CustomerAuthEmailKind, email: string, ip: string) {
  const db = getSupabaseAdmin();
  const checks = [
    { scope: `${kind}:email`, hash: digest(email), limit: 3 },
    { scope: `${kind}:ip`, hash: digest(ip), limit: 10 },
  ];
  for (const check of checks) {
    const { data, error } = await db.rpc('customer_auth_rate_limit', {
      p_scope: check.scope,
      p_identifier_hash: check.hash,
      p_limit: check.limit,
      p_window_seconds: 600,
    });
    if (error) return fallbackRateLimited(`${kind}:${ip}:${email}`);
    if (data !== true) return true;
  }
  return false;
}

export function customerAuthLink(req: Request, tokenHash: string, type: CustomerAuthEmailKind) {
  const configured = new URL(BUSINESS.domain);
  const requestUrl = new URL(req.url);
  const origin = /^(localhost|127\.0\.0\.1)$/.test(requestUrl.hostname) ? requestUrl.origin : configured.origin;
  const url = new URL('/my-account', origin);
  // The fragment never reaches Vercel/Supabase request logs or Referer headers.
  url.hash = new URLSearchParams({
    token_hash: tokenHash,
    type: type === 'signup' ? 'signup' : 'recovery',
  }).toString();
  return url.toString();
}
