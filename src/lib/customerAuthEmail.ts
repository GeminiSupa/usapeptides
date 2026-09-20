import 'server-only';

import { createHmac } from 'node:crypto';
import nodemailer from 'nodemailer';
import { BUSINESS, features, resendEnv, smtpEnv, supabaseEnv } from './env';
import { getSupabaseAdmin } from './supabaseAdmin';

/** Kinds that carry a one-time token. */
export type CustomerAuthEmailKind = 'signup' | 'recovery';

/**
 * Kinds with no token. These exist so the signup form can give every visitor
 * the same enumeration-safe reply while the mailbox owner — and only the
 * mailbox owner — still learns what actually happened.
 */
export type CustomerNoticeKind = 'already-registered' | 'staff-account' | 'no-account';

interface AuthEmailInput {
  to: string;
  kind: CustomerAuthEmailKind | CustomerNoticeKind;
  url: string;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** Send customer-security mail without exposing the Resend key to the browser. */
export async function sendCustomerAuthEmail({ to, kind, url }: AuthEmailInput) {
  if (!features.email) throw new Error('Email is not configured for this deployment.');

  const copy = {
    signup: {
      subject: `Verify your ${BUSINESS.name} account`,
      heading: 'Verify your email address',
      action: 'Verify email and open account',
      explanation: 'Use the secure link below to finish creating your customer account.',
      footnote: 'This link can be used once.',
    },
    recovery: {
      subject: `Reset your ${BUSINESS.name} password`,
      heading: 'Reset your password',
      action: 'Choose a new password',
      explanation:
        'Use the secure link below to choose a new password. If you did not request this, you can ignore this email.',
      footnote: 'This link can be used once.',
    },
    'already-registered': {
      subject: `You already have a ${BUSINESS.name} account`,
      heading: 'You already have an account',
      action: 'Go to sign in',
      explanation:
        'Someone asked to create an account with this email address, but one already exists. Sign in with your existing password, or use "Reset password" on the sign-in page if you have forgotten it. No new account was created and nothing has changed.',
      footnote: 'If this was not you, you can ignore this email.',
    },
    'no-account': {
      subject: `Password reset requested for ${BUSINESS.name}`,
      heading: 'No account for this address',
      action: 'Create an account',
      explanation:
        'Someone asked to reset the password for this email address, but there is no customer account for it. You may have signed up with a different address. You can create an account using the link below.',
      footnote: 'If this was not you, you can ignore this email. No account exists to change.',
    },
    'staff-account': {
      subject: `This address is a ${BUSINESS.name} dashboard account`,
      heading: 'This address is already a dashboard account',
      action: 'Open the dashboard',
      explanation:
        'Someone asked to create a customer account with this email address. It is already registered as a staff dashboard account, and the two cannot share an address. To create a customer account, sign up with a different email address. No customer account was created and nothing has changed.',
      footnote: 'If this was not you, you can ignore this email.',
    },
  }[kind];

  const { subject, heading, action, explanation, footnote } = copy;
  const support = `This message was sent from an unmonitored address — please do not reply to it. For help, email ${BUSINESS.supportEmail} or call ${BUSINESS.supportPhone}.`;
  const html = `<!doctype html><html><body style="margin:0;background:#fdfbf0;color:#233049;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><h1 style="color:#1f4233;font-size:24px">${heading}</h1><p>${explanation}</p><p style="margin:28px 0"><a href="${url}" style="display:inline-block;background:#1f4233;color:#fff;text-decoration:none;padding:14px 20px;font-weight:700">${action}</a></p><p style="font-size:13px;color:#596274">${footnote}</p><p style="font-size:13px;color:#596274">${support}</p></div></body></html>`;
  const text = `${heading}\n\n${explanation}\n\n${url}\n\n${footnote}\n\n${support}`;
  const automatedSender = `${BUSINESS.name} (do not reply)`;

  if (resendEnv.apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendEnv.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `"${automatedSender}" <${resendEnv.from}>`,
        to: [to],
        // The From address is not a mailbox; a reply must reach a person.
        reply_to: BUSINESS.supportEmail,
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
    replyTo: BUSINESS.supportEmail,
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

/** The site origin to use in email links; the local origin only in dev. */
function linkOrigin(req: Request) {
  const requestUrl = new URL(req.url);
  return /^(localhost|127\.0\.0\.1)$/.test(requestUrl.hostname)
    ? requestUrl.origin
    : new URL(BUSINESS.domain).origin;
}

/** A plain page link for notice emails, which carry no token. */
export function customerPageLink(req: Request, path: string) {
  return new URL(path, linkOrigin(req)).toString();
}

export function customerAuthLink(req: Request, tokenHash: string, type: CustomerAuthEmailKind) {
  const url = new URL('/my-account', linkOrigin(req));
  // The fragment never reaches Vercel/Supabase request logs or Referer headers.
  url.hash = new URLSearchParams({
    token_hash: tokenHash,
    type: type === 'signup' ? 'signup' : 'recovery',
  }).toString();
  return url.toString();
}
