'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MailX, Check } from 'lucide-react';

export default function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');

    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setState('error');
        setMessage(payload?.message ?? 'Could not process that request. Please try again.');
        return;
      }

      setState('done');
    } catch {
      setState('error');
      setMessage('Could not reach the server. Please try again in a moment.');
    }
  };

  return (
    <div className="shell max-w-xl space-y-8 py-16">
      <div className="text-center">
        <MailX className="mx-auto h-7 w-7 text-brand-accentGlow" strokeWidth={1.75} />
        <h1 className="page-title mt-5">Unsubscribe</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted sm:text-sm">
          Enter the address you would like removed from our mailing list. This does not affect order
          confirmations or replies to support enquiries.
        </p>
      </div>

      {state === 'done' ? (
        <div className="border border-brand-border bg-brand-card p-8 text-center">
          <Check className="mx-auto h-6 w-6 text-brand-accentGlow" />
          <p className="mt-4 font-display text-sm font-extrabold text-brand-heading">
            That address has been removed
          </p>
          <p className="mt-2 text-xs leading-relaxed text-brand-textMuted">
            You will not receive further marketing email from us. It can take up to 48 hours for
            anything already queued to stop.
          </p>
          <Link href="/" className="btn-ghost mt-6">
            Back to the shop
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.edu"
            className="w-full border border-brand-border bg-brand-card px-3 py-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />

          {state === 'error' && (
            <p className="text-[0.6875rem] text-brand-accentGlow">{message}</p>
          )}

          <button
            type="submit"
            disabled={state === 'loading'}
            className="btn-primary w-full disabled:opacity-60"
          >
            {state === 'loading' ? 'Removing...' : 'Unsubscribe'}
          </button>
        </form>
      )}
    </div>
  );
}
