'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supabase) {
      setError('Supabase is not configured for this deployment.');
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (authError) {
      setError('Those credentials were not accepted.');
      return;
    }

    router.push('/admin');
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-brand-accentGlow" strokeWidth={1.75} />
          <h1 className="page-title mt-4">Dashboard</h1>
          <p className="mt-2 text-xs text-brand-textMuted">USA Peptide Depot staff access</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="border border-brand-border bg-brand-card p-5 text-xs leading-relaxed text-brand-textMuted">
            Supabase is not configured for this deployment, so sign-in is unavailable. Add the
            Supabase environment variables and redeploy.
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-3">
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-brand-border bg-brand-card px-3 py-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
            />
            <div className="relative">
              <input required type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                className="w-full border border-brand-border bg-brand-card px-3 py-3 pr-11 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none" />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brand-textMuted hover:text-brand-heading">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && <p className="text-[0.6875rem] text-brand-accentGlow">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[0.625rem] leading-relaxed text-brand-textMuted">
          Access is limited to addresses on the administrator allow-list. Signing in with a customer
          account will not grant dashboard access.
        </p>
      </div>
    </div>
  );
}
