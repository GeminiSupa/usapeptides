import 'server-only';

import { Resolver } from 'node:dns/promises';
import { BUSINESS, resendEnv, smtpEnv, features } from './env';

/**
 * Why our email lands in spam, answered from the domain's own DNS.
 *
 * A new domain has no reputation, so the three authentication records are the
 * only thing telling Gmail this mail is really ours. Missing any of them is
 * the single most common reason a brand-new store goes straight to the junk
 * folder, and it is the one thing a drip sequence cannot fix.
 *
 * Read-only: this looks up public DNS records and never changes anything.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  /** What we found, in plain English. */
  detail: string;
  /** What the owner has to do about it. */
  fix?: string;
  /** The exact DNS record to add, when there is one. */
  record?: { type: string; name: string; value: string };
  /** What was actually in DNS, for the curious. */
  found?: string[];
}

export interface DeliverabilityReport {
  /** The domain the From address sits on - the one whose reputation matters. */
  sendingDomain: string | null;
  fromAddress: string | null;
  provider: 'resend' | 'smtp' | 'none';
  checks: Check[];
  score: { passed: number; total: number };
  /** Set when DNS could not be read at all, rather than read as empty. */
  error: string | null;
}

const TIMEOUT_MS = 4000;

const domainOf = (address: string): string | null => {
  const at = String(address ?? '').split('@')[1];
  const host = String(at ?? '').trim().toLowerCase().replace(/[>\s]/g, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
};

/** The registrable part, so mail.example.co.uk still reports example.co.uk. */
const rootDomain = (host: string): string => {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  // Handles the common two-part suffixes without shipping a public-suffix list.
  if (/^(co|com|net|org|ac|gov|edu)\.[a-z]{2}$/.test(last2) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return last2;
};

function resolver() {
  const r = new Resolver({ timeout: TIMEOUT_MS, tries: 2 });
  // Public resolvers, so the answer does not depend on the host's own DNS.
  r.setServers(['1.1.1.1', '8.8.8.8']);
  return r;
}

async function txt(host: string): Promise<string[]> {
  try {
    const records = await resolver().resolveTxt(host);
    return records.map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

async function mx(host: string): Promise<string[]> {
  try {
    return (await resolver().resolveMx(host)).map((r) => `${r.priority} ${r.exchange}`);
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- checks -- */

/**
 * SPF, which lives in one of two places.
 *
 * Resend signs as a subdomain (`send.<domain>`) and puts its SPF there, listing
 * its own sending IPs rather than an include - that subdomain is the one SPF is
 * actually checked against, because it is the Return-Path. The apex record
 * usually belongs to whoever hosts the mailbox and has nothing to do with us.
 * Checking only the apex reports a perfectly good setup as broken, which is
 * exactly what an earlier version of this did.
 */
function spfCheck(domain: string, apex: string[], sub: string[], provider: string): Check {
  const only = (records: string[]) => records.filter((r) => /^v=spf1\b/i.test(r.trim()));
  const apexSpf = only(apex);
  const subSpf = only(sub);
  const record = {
    type: 'TXT',
    name: provider === 'resend' ? `send.${domain}` : domain,
    value: provider === 'resend'
      ? 'the SPF value the Resend dashboard gives you'
      : `v=spf1 include:${smtpEnv.host || 'your-mail-host'} ~all`,
  };

  const tooMany = [...apexSpf, ...subSpf].length && (apexSpf.length > 1 || subSpf.length > 1);
  if (tooMany) {
    return {
      id: 'spf', label: 'SPF', status: 'fail',
      detail: 'One name has more than one SPF record. That is invalid, and every check against it fails.',
      fix: 'Keep a single record on each name and merge the rest into it.',
      found: [...apexSpf, ...subSpf], record,
    };
  }

  // The record that actually covers our mail: the sending subdomain when there
  // is one, otherwise the apex.
  const relevant = subSpf[0] ?? apexSpf[0] ?? null;

  if (!relevant) {
    return {
      id: 'spf', label: 'SPF', status: 'fail',
      detail: 'No SPF record anywhere. Receiving servers have nothing saying we may send as this domain.',
      fix: 'Add the SPF record your sending service gives you, then check again in an hour.',
      record,
    };
  }

  if (/\+all\b/i.test(relevant)) {
    return {
      id: 'spf', label: 'SPF', status: 'fail',
      detail: 'The SPF record ends in +all, which tells the world that anybody may send as this domain.',
      fix: 'Change +all to ~all.',
      found: [relevant], record,
    };
  }

  if (subSpf.length) {
    return {
      id: 'spf', label: 'SPF', status: 'pass',
      detail: `SPF is published on send.${domain}, which is the name our mail is checked against.`,
      found: subSpf,
    };
  }

  // Only an apex record. For SMTP we can look for the host; for an HTTP API we
  // cannot tell from DNS alone, so this is a warning rather than a failure.
  const host = smtpEnv.host.toLowerCase().replace(/^smtp\./, '');
  if (provider === 'smtp' && host && relevant.toLowerCase().includes(host)) {
    return { id: 'spf', label: 'SPF', status: 'pass', detail: 'SPF is published and lists our mail host.', found: apexSpf };
  }

  return {
    id: 'spf', label: 'SPF', status: 'warn',
    detail: 'There is an SPF record on the domain, but nothing on the sending subdomain and it does not obviously list our sending service.',
    fix: 'Check in the sending service that the domain shows as verified. If it asks for a record on a subdomain, add that one rather than editing this one.',
    found: apexSpf, record,
  };
}

function dkimCheck(domain: string, bySelector: Record<string, string[]>): Check {
  const present = Object.entries(bySelector).filter(([, v]) => v.some((r) => /p=[A-Za-z0-9+/]/.test(r)));
  if (present.length) {
    return {
      id: 'dkim', label: 'DKIM', status: 'pass',
      detail: `DKIM is published on the ${present.map(([s]) => s).join(', ')} selector.`,
    };
  }
  return {
    id: 'dkim', label: 'DKIM', status: 'fail',
    detail: 'No DKIM key found, so nothing signs our email and Gmail cannot prove it was not altered.',
    fix: resendEnv.apiKey
      ? `Add the domain in the Resend dashboard, copy the three records it gives you (DKIM, SPF and the MX for ${domain}), and add them at your registrar.`
      : 'Ask your mail provider for the DKIM record and add it at your registrar.',
    record: { type: 'TXT', name: `resend._domainkey.${domain}`, value: 'the value your provider gives you' },
  };
}

function dmarcCheck(domain: string, records: string[]): Check {
  const dmarc = records.filter((r) => /^v=DMARC1\b/i.test(r.trim()));
  const record = {
    type: 'TXT',
    name: `_dmarc.${domain}`,
    value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; pct=100; adkim=s; aspf=s`,
  };

  if (!dmarc.length) {
    return {
      id: 'dmarc', label: 'DMARC', status: 'fail',
      detail: 'No DMARC record. Since February 2024 Gmail and Yahoo require one from anybody sending bulk email.',
      fix: 'Add this TXT record. p=none only watches - it changes nothing about delivery, and it is the right place to start.',
      record,
    };
  }
  const one = dmarc[0];
  const policy = /p=(none|quarantine|reject)/i.exec(one)?.[1]?.toLowerCase() ?? 'none';
  if (policy === 'none') {
    return {
      id: 'dmarc', label: 'DMARC', status: 'pass',
      detail: 'DMARC is published with p=none, which satisfies the bulk-sender rules while you watch the reports.',
      fix: 'Once SPF and DKIM have been passing for a few weeks, move to p=quarantine.',
      found: dmarc,
    };
  }
  return { id: 'dmarc', label: 'DMARC', status: 'pass', detail: `DMARC is published with p=${policy}.`, found: dmarc };
}

/* --------------------------------------------------------------- report -- */

export async function checkDeliverability(): Promise<DeliverabilityReport> {
  const provider: DeliverabilityReport['provider'] =
    resendEnv.apiKey ? 'resend' : (smtpEnv.host && smtpEnv.user ? 'smtp' : 'none');
  const fromAddress = provider === 'resend' ? resendEnv.from : (provider === 'smtp' ? smtpEnv.from : null);
  const sendingDomain = fromAddress ? domainOf(fromAddress) : null;
  const checks: Check[] = [];

  if (provider === 'none' || !features.email) {
    checks.push({
      id: 'provider', label: 'Sending service', status: 'fail',
      detail: 'No email service is connected, so nothing can be sent at all.',
      fix: 'Add RESEND_API_KEY and RESEND_FROM in Vercel (type Config, not Secret), then redeploy.',
    });
    return { sendingDomain, fromAddress, provider, checks, score: { passed: 0, total: checks.length }, error: null };
  }

  checks.push({
    id: 'provider', label: 'Sending service', status: 'pass',
    detail: provider === 'resend' ? 'Sending through Resend.' : `Sending through SMTP at ${smtpEnv.host}.`,
  });

  // The whole point: mail from a shared provider domain builds that provider's
  // reputation, never ours, and reads as untrusted to a recipient.
  const siteDomain = domainOf(`x@${BUSINESS.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`)
    ?? domainOf(BUSINESS.supportEmail);
  const onOwnDomain = Boolean(sendingDomain && siteDomain && rootDomain(sendingDomain) === rootDomain(siteDomain));

  if (!sendingDomain || /resend\.dev|sendgrid\.net|onmicrosoft\.com/i.test(sendingDomain)) {
    checks.push({
      id: 'from', label: 'From address', status: 'fail',
      detail: `Email is being sent from ${fromAddress}, a shared address on the provider's own domain. It builds no reputation for us and looks untrustworthy to anybody who reads it.`,
      fix: `Verify ${siteDomain ?? 'your own domain'} in the Resend dashboard and set RESEND_FROM to an address on it, then redeploy.`,
    });
  } else if (!onOwnDomain) {
    checks.push({
      id: 'from', label: 'From address', status: 'warn',
      detail: `Email is sent from ${fromAddress}, which is not on ${siteDomain}. Recipients trust a From address that matches the site.`,
      fix: `Send from an address on ${siteDomain}.`,
    });
  } else {
    checks.push({ id: 'from', label: 'From address', status: 'pass', detail: `Sending as ${fromAddress}, on our own domain.` });
  }

  if (!sendingDomain) {
    return { sendingDomain, fromAddress, provider, checks, score: score(checks), error: null };
  }

  let error: string | null = null;
  try {
    const [apex, dmarcRecords, sub, mxRecords, ...dkim] = await Promise.all([
      txt(sendingDomain),
      txt(`_dmarc.${sendingDomain}`),
      txt(`send.${sendingDomain}`),
      mx(sendingDomain),
      txt(`resend._domainkey.${sendingDomain}`),
      txt(`default._domainkey.${sendingDomain}`),
      txt(`s1._domainkey.${sendingDomain}`),
      txt(`google._domainkey.${sendingDomain}`),
    ]);

    checks.push(spfCheck(sendingDomain, apex, sub, provider));
    checks.push(dkimCheck(sendingDomain, {
      resend: dkim[0], default: dkim[1], s1: dkim[2], google: dkim[3],
    }));
    checks.push(dmarcCheck(sendingDomain, dmarcRecords));

    checks.push(mxRecords.length
      ? { id: 'mx', label: 'Replies', status: 'pass', detail: 'The domain has MX records, so a customer who replies reaches a real mailbox.', found: mxRecords }
      : {
          id: 'mx', label: 'Replies', status: 'warn',
          detail: 'The domain has no MX records, so replies bounce. Filters also treat a domain that cannot receive mail as less trustworthy.',
          fix: 'Point the domain at a mailbox (Google Workspace, Zoho, whatever you use) and set Reply-To to a real address.',
        });
  } catch (err) {
    error = err instanceof Error ? err.message : 'DNS lookup failed';
    checks.push({
      id: 'dns', label: 'DNS', status: 'unknown',
      detail: 'The DNS records could not be read just now, so SPF, DKIM and DMARC are unknown.',
      fix: 'Try again in a minute.',
    });
  }

  return { sendingDomain, fromAddress, provider, checks, score: score(checks), error };
}

const score = (checks: Check[]) => ({
  passed: checks.filter((c) => c.status === 'pass').length,
  total: checks.length,
});
