'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

/**
 * Set a starting password — used both when approving an invite and when
 * resetting one somebody has forgotten.
 *
 * The value is typed in plain sight so it can be copied once, and is never
 * stored anywhere readable: Supabase keeps a hash, the audit log records only
 * that a reset happened, and nothing echoes it back.
 */

interface Props {
  title: string;
  subtitle: string;
  note: string;
  confirmLabel: string;
  minPassword: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}

export default function PasswordModal({
  title, subtitle, note, confirmLabel, minPassword, busy, error, onCancel, onSubmit,
}: Props) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const tooShort = password.length > 0 && password.length < minPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 py-12">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto border border-brand-border bg-brand-card [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <div className="flex items-start justify-between border-b border-brand-border px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              {title}
            </h2>
            <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">{subtitle}</p>
          </div>
          <button onClick={onCancel} className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(password); }}
          className="space-y-4 p-5"
        >
          <p className="border border-brand-border bg-brand-dark p-3 text-[0.75rem] leading-relaxed text-brand-textMuted">
            {note}
          </p>

          <label className="block">
            <span className="eyebrow mb-1.5 block">Password</span>
            <div className="relative">
              <input required type={visible ? 'text' : 'password'} autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${minPassword} characters`}
                className="w-full border border-brand-border bg-brand-dark px-3 py-2 pr-11 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none" />
              <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brand-textMuted hover:text-brand-heading">
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className={`mt-1 block text-[0.75rem] ${tooShort ? 'text-brand-accentGlow' : 'text-brand-textMuted'}`}>
              {tooShort
                ? `${minPassword - password.length} more character${minPassword - password.length === 1 ? '' : 's'} needed.`
                : 'Copy it now — it cannot be read back later.'}
            </span>
          </label>

          {error && <p className="text-[0.8125rem] text-brand-accentGlow">{error}</p>}

          <div className="flex gap-2 border-t border-brand-border pt-4">
            <button
              type="submit"
              disabled={busy || password.length < minPassword}
              className="btn-primary flex-1 disabled:opacity-60"
            >
              {busy ? 'Saving...' : confirmLabel}
            </button>
            <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
