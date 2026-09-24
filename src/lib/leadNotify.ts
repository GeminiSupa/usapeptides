import 'server-only';

import nodemailer from 'nodemailer';

import { BUSINESS, features, resendEnv, smtpEnv } from './env';
import { GOAL_OPTIONS, INTEREST_OPTIONS, choiceLabel, type LeadIntakeInput } from './leadIntake';

/**
 * Tells the sales mailbox about a lead the moment it arrives.
 *
 * Best effort by design: the lead is already saved before this runs, and a
 * refused SMTP login must never turn a captured lead into a 500 for the
 * visitor. Failures are logged, not thrown. With no email credentials the
 * notification simply does not happen — the lead is still in the CRM and the
 * dashboard bell still rings, which is the trigger in migration 0023.
 */
export async function notifyNewLead(lead: LeadIntakeInput, opts: { isNew: boolean; leadId: string }) {
  if (!features.email) return;

  const to = smtpEnv.orderNotificationTo || BUSINESS.supportEmail;
  if (!to) return;

  const heading = opts.isNew ? 'New lead' : 'Returning lead';
  const subject = `${heading}: ${lead.full_name} — ${lead.lead_source}`;

  const rows: [string, string][] = [
    ['Name', lead.full_name],
    ['Phone', lead.phone],
    ['Email', lead.email],
    ['Interested in', choiceLabel(lead.interest, INTEREST_OPTIONS)],
    ['Primary goal', choiceLabel(lead.goal, GOAL_OPTIONS)],
    ['Site', lead.lead_source],
    ['Number on that site', lead.tracking_phone || '—'],
    ['Message', lead.message || '—'],
  ];

  const text = [
    `${heading} from ${lead.lead_source}`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Open it: ${new URL('/admin?section=leads', BUSINESS.domain).toString()}`,
  ].join('\n');

  const html = [
    `<p style="font:600 15px/1.4 system-ui,sans-serif;color:#1F4233">${escapeHtml(heading)} from ${escapeHtml(lead.lead_source)}</p>`,
    '<table style="font:14px/1.5 system-ui,sans-serif;color:#233049;border-collapse:collapse">',
    ...rows.map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`
    ),
    '</table>',
    `<p style="font:14px system-ui,sans-serif"><a href="${new URL('/admin?section=leads', BUSINESS.domain).toString()}">Open the lead in the dashboard</a></p>`,
  ].join('');

  try {
    if (resendEnv.apiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendEnv.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: resendEnv.from,
          to: [to],
          reply_to: lead.email,
          subject,
          html,
          text,
        }),
        cache: 'no-store',
      });
      if (!response.ok) console.warn('[lead-intake] Resend refused the alert:', response.status);
      return;
    }

    if (!smtpEnv.host || !smtpEnv.user || !smtpEnv.pass) return;
    await nodemailer
      .createTransport({
        host: smtpEnv.host,
        port: smtpEnv.port,
        secure: smtpEnv.secure,
        auth: { user: smtpEnv.user, pass: smtpEnv.pass },
      })
      .sendMail({ from: smtpEnv.from, to, replyTo: lead.email, subject, html, text });
  } catch (err) {
    console.warn('[lead-intake] lead alert not sent:', err instanceof Error ? err.message : err);
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
