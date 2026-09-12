'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Check, Wallet } from 'lucide-react';

/**
 * What a sub-user sees. Their rate, their referral link, and nothing else —
 * no orders, no customers, no colleagues.
 *
 * The earnings figure is deliberately absent rather than shown as zero. Orders
 * do not yet carry a referral column, so there is nothing to total, and a
 * confident "$0.00" would read as "you have earned nothing" rather than "this
 * is not wired up yet". Saying so plainly is the honest version.
 */

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  me: {
    id: string;
    email: string;
    fullName: string | null;
    tier: 'staff' | 'sub_user';
  };
}

interface Mine {
  id: string;
  commission_rate: number | null;
  parent_user_id: string | null;
  status: string;
}

export default function SubUserHome({ authedFetch, me }: Props) {
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authedFetch('/api/admin/me')
      .then((res) => res.json())
      .then((p) => {
        // /api/admin/me carries the rate for the signed-in person, which is the
        // only person's rate a sub-user is allowed to see.
        setMine({
          id: p?.data?.id,
          commission_rate: p?.data?.commissionRate ?? null,
          parent_user_id: null,
          status: p?.data?.status ?? 'active',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authedFetch]);

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/?ref=${me.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="border border-brand-border bg-brand-card p-5">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
          {me.fullName || me.email}
        </h2>
        <p className="mt-1 text-[0.6875rem] text-brand-textMuted">
          {loading
            ? 'Loading...'
            : mine?.commission_rate != null
              ? `Your commission rate is ${Number(mine.commission_rate)}%.`
              : 'Your commission rate has not been set yet.'}
        </p>
      </div>

      <div className="border border-brand-border bg-brand-card p-5">
        <h3 className="eyebrow mb-2">Your referral link</h3>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap border border-brand-border bg-brand-dark px-3 py-2 font-mono text-[0.6875rem] text-brand-heading">
            {link}
          </code>
          <button
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 border border-brand-borderLight px-3 py-2 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
          >
            {copied ? <Check className="h-3 w-3 text-whatsapp" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="border border-brand-border bg-brand-card p-5">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-textMuted" strokeWidth={1.75} />
          <div>
            <h3 className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              Earnings are not being tracked yet
            </h3>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-brand-textMuted">
              Orders do not yet record which referral link brought them in, so there is no total to
              show you. Rather than print a figure of zero and have it read as “you have earned
              nothing”, this says plainly that the plumbing is not finished. Your rate and your link
              above are real and already saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
