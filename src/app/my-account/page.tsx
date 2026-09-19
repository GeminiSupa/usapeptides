'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, History, KeyRound, Loader2, LogOut, Package, User } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { BUSINESS } from '@/lib/env';

/**
 * My account.
 *
 * Customers can create and verify their own account, or an administrator can
 * still create one from Dashboard > Customers. Row-level security lets a
 * signed-in customer read only their own profile, orders and order lines.
 */

interface Profile { id: string; email: string; full_name: string | null; institution: string | null; phone: string | null }
interface OrderLine { id: string; product_name: string; product_slug: string; quantity: number; line_total: number }
interface Order {
  id: string; order_number: string; status: string; grand_total: number; currency: string;
  tracking_number: string | null; created_at: string; order_items: OrderLine[];
}

const MIN_PASSWORD = 12;
const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n ?? 0));

const inputClass =
  'w-full border border-brand-border bg-brand-dark px-3 py-2.5 text-sm text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none';

export default function MyAccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'signin' | 'register' | 'recover'>('signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    const client = supabase;
    client.auth.getSession().then(async ({ data }) => {
      let next = data.session;
      try {
        const keep = localStorage.getItem('upd_customer_remember') !== '0';
        const activeTab = sessionStorage.getItem('upd_customer_session_active') === '1';
        if (next && !keep && !activeTab) { await client.auth.signOut(); next = null; }
        if (next) sessionStorage.setItem('upd_customer_session_active', '1');
      } catch { /* storage unavailable: keep Supabase's secure default */ }
      setSession(next); setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const params = fragment.has('token_hash') ? fragment : query;
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || (type !== 'signup' && type !== 'recovery')) return;
    window.history.replaceState({}, '', '/my-account');

    setBusy(true); setError(''); setNotice(type === 'signup' ? 'Verifying your email…' : 'Opening your secure password reset…');
    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(async ({ data, error: verifyError }) => {
      if (verifyError || !data.session) {
        setError('This secure link is invalid or has expired. Request a new one.');
        setNotice(''); setBusy(false);
        return;
      }
      if (type === 'signup') {
        const response = await fetch('/api/customer/auth/complete', {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (!response.ok) {
          const result = await response.json().catch(() => null) as { message?: string } | null;
          setError(result?.message || 'Your email was verified, but the customer profile could not be linked.');
        } else {
          setNotice('Email verified. Your customer account is ready.');
        }
      } else {
        setChanging(true);
        setPasswordNotice('Choose a new password below.');
        setNotice('Secure reset opened.');
      }
      window.history.replaceState({}, '', '/my-account');
      setSession(data.session); setBusy(false);
    }).catch(() => {
      setError('Could not verify this secure link. Please try again.');
      setNotice(''); setBusy(false);
    });
  }, []);

  const loadAccount = useCallback(async () => {
    if (!supabase || !session) return;
    setLoadingData(true);
    let { data: p } = await supabase
      .from('customer_profiles')
      .select('id, email, full_name, institution, phone')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!p) {
      const { data: current } = await supabase.auth.getSession();
      if (current.session) {
        await fetch('/api/customer/auth/complete', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.session.access_token}` },
        });
        const retry = await supabase.from('customer_profiles')
          .select('id, email, full_name, institution, phone')
          .eq('user_id', session.user.id)
          .maybeSingle();
        p = retry.data;
      }
    }
    setProfile((p as Profile) ?? null);
    if (p) {
      const { data: o } = await supabase
        .from('orders')
        .select('id, order_number, status, grand_total, currency, tracking_number, created_at, order_items (id, product_name, product_slug, quantity, line_total)')
        .eq('customer_id', p.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setOrders((o as Order[]) ?? []);
    } else {
      setOrders([]);
    }
    setLoadingData(false);
  }, [session]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setError(/invalid/i.test(authError.message)
        ? 'Incorrect email or password. Try again, or select “Reset password” below.'
        : authError.message);
      return;
    }
    try {
      localStorage.setItem('upd_customer_remember', remember ? '1' : '0');
      sessionStorage.setItem('upd_customer_session_active', '1');
    } catch { /* browser storage unavailable */ }
    setPassword('');
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (fullName.trim().length < 2) { setError('Enter your full name.'); return; }
    if (password.length < MIN_PASSWORD) { setError(`Use at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== confirmPassword) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    const response = await fetch('/api/customer/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, fullName, phone, marketingOptIn }),
    }).catch(() => null);
    if (!response) { setBusy(false); setError('Unable to connect. Please try again.'); return; }
    const result = await response.json().catch(() => null) as { data?: { message?: string }; message?: string } | null;
    setBusy(false);
    if (!response.ok) { setError(result?.message || 'Could not create the account.'); return; }
    setNotice(result?.data?.message || 'Check your email for the verification link.');
    setPassword(''); setConfirmPassword('');
  };

  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    const response = await fetch('/api/customer/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    if (!response) { setBusy(false); setError('Unable to connect. Please try again.'); return; }
    const result = await response.json().catch(() => null) as { message?: string } | null;
    setBusy(false);
    if (!response.ok) { setError(result?.message || 'Could not request the reset email.'); return; }
    setNotice('If a customer account exists for that email, a secure reset link has been sent.');
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    try { localStorage.removeItem('upd_customer_remember'); sessionStorage.removeItem('upd_customer_session_active'); } catch { /* ignore */ }
    setProfile(null); setOrders([]);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (newPassword.length < MIN_PASSWORD) { setPasswordNotice(`Use at least ${MIN_PASSWORD} characters.`); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    setPasswordNotice(updateError ? updateError.message : 'Password changed.');
    if (!updateError) { setNewPassword(''); setChanging(false); setNotice('Your password has been changed.'); }
  };

  return (
    <div className="shell max-w-4xl space-y-8 py-10">
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">Customer account</div>
        <h1 className="page-title">My account</h1>
      </div>

      {!ready ? (
        <p className="text-sm text-brand-textMuted">Loading…</p>
      ) : !supabase ? (
        <p className="border border-brand-border bg-brand-card p-6 text-sm text-brand-body">Accounts are not available on this site yet.</p>
      ) : !session ? (
        <div className="mx-auto max-w-md space-y-5 border border-brand-border bg-brand-card p-6 sm:p-8">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-brand-border bg-brand-darker text-brand-accentGlow">
              <User className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-brand-heading">
              {mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}
            </h2>
            <p className="text-xs text-brand-textMuted">
              {mode === 'signin' ? 'See your orders and tracking numbers.'
                : mode === 'register' ? 'Your verified email links existing orders automatically.'
                  : 'We will email you a secure password-reset link.'}
            </p>
          </div>

          <div className="grid grid-cols-2 border border-brand-border">
            <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className={`px-3 py-2 text-xs font-bold ${mode === 'signin' ? 'bg-brand-accent text-brand-onAccent' : 'bg-brand-dark text-brand-body'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(''); setNotice(''); }}
              className={`px-3 py-2 text-xs font-bold ${mode === 'register' ? 'bg-brand-accent text-brand-onAccent' : 'bg-brand-dark text-brand-body'}`}>
              Create account
            </button>
          </div>

          <form noValidate onSubmit={mode === 'register' ? register : mode === 'recover' ? recover : signIn} className="space-y-4">
            {mode === 'register' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-brand-textMuted">Full name</span>
                  <input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-brand-textMuted">Phone (optional)</span>
                  <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                </label>
              </>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-brand-textMuted">Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
            {mode !== 'recover' && (
              <label className="block">
                <span className="mb-1 block text-xs text-brand-textMuted">Password</span>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required
                    minLength={mode === 'register' ? MIN_PASSWORD : undefined}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-textMuted hover:text-brand-heading">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'register' && <span className="mt-1 block text-xs text-brand-textMuted">Use at least {MIN_PASSWORD} characters.</span>}
              </label>
            )}
            {mode === 'register' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-brand-textMuted">Confirm password</span>
                  <div className="relative">
                    <input type={showConfirmPassword ? 'text' : 'password'} required minLength={MIN_PASSWORD} autoComplete="new-password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pr-10`} />
                    <button type="button" aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-textMuted hover:text-brand-heading">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <label className="flex items-start gap-2 text-xs text-brand-body">
                  <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-forest" />
                  Email me product and research updates (optional)
                </label>
              </>
            )}
            {mode === 'signin' && (
              <label className="flex items-center gap-2 text-xs text-brand-body">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-forest" />
                Keep me signed in on this browser
              </label>
            )}
            {error && <p className="border border-action/50 p-2.5 text-xs text-brand-body">{error}</p>}
            {notice && <p className="border border-brand-border bg-brand-darker p-2.5 text-xs text-brand-body">{notice}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Email reset link'}
            </button>
          </form>
          {mode === 'signin' && (
            <button type="button" onClick={() => { setMode('recover'); setError(''); setNotice(''); }}
              className="block w-full text-center text-xs text-brand-textMuted underline">
              Reset password
            </button>
          )}
          {mode === 'recover' && (
            <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
              className="block w-full text-center text-xs text-brand-textMuted underline">
              Back to sign in
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {notice && <p className="border border-brand-border bg-brand-card p-3 text-xs text-brand-body">{notice}</p>}
          {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4 border border-brand-border bg-brand-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center bg-brand-accent text-brand-onAccent">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-brand-heading">{profile?.full_name || session.user.email}</h2>
                <p className="font-mono text-xs text-brand-textMuted">{session.user.email}</p>
                {profile?.institution && <p className="text-xs text-brand-textMuted">{profile.institution}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setChanging((c) => !c); setPasswordNotice(''); }} className="btn-ghost px-4 py-2.5">
                <KeyRound className="h-3.5 w-3.5" /> Password
              </button>
              <button onClick={() => void signOut()} className="btn-ghost px-4 py-2.5">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>

          {(changing || passwordNotice) && (
            <form onSubmit={changePassword} className="space-y-3 border border-brand-border bg-brand-card p-5">
              {changing && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs text-brand-textMuted">New password (at least {MIN_PASSWORD} characters)</span>
                    <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
                  </label>
                  <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5">Save new password</button>
                </>
              )}
              {passwordNotice && <p className="text-xs text-brand-body">{passwordNotice}</p>}
            </form>
          )}

          <div className="space-y-4 border border-brand-border bg-brand-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-brand-heading">
              <History className="h-4 w-4 text-brand-accentGlow" /> Your orders
            </h3>
            {loadingData ? (
              <p className="text-xs text-brand-textMuted">Loading…</p>
            ) : !profile ? (
              <p className="border border-brand-border bg-brand-darker p-6 text-center text-xs text-brand-textMuted">
                This sign-in is not linked to a customer record. Contact {BUSINESS.name} and we will fix it.
              </p>
            ) : orders.length === 0 ? (
              <p className="border border-brand-border bg-brand-darker p-6 text-center text-xs text-brand-textMuted">
                No orders yet. <Link href="/shop" className="underline">Visit the shop</Link>.
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="border border-brand-border bg-brand-dark p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-bold text-brand-heading">{o.order_number}</p>
                        <p className="text-xs text-brand-textMuted">{new Date(o.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="chip bg-brand-accent text-brand-onAccent">{o.status === 'completed' ? 'Order completed' : o.status}</span>
                        <span className="font-display text-sm font-bold text-brand-heading">{money(o.grand_total, o.currency)}</span>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 border-t border-brand-border pt-3 text-xs text-brand-body">
                      {o.order_items.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3">
                          <Link href={`/product/${line.product_slug}`} className="hover:underline">
                            <Package className="mr-1 inline h-3 w-3" />{line.product_name} × {line.quantity}
                          </Link>
                          <span className="font-mono">{money(line.line_total, o.currency)}</span>
                        </li>
                      ))}
                    </ul>
                    {o.tracking_number && (
                      <p className="mt-2 text-xs text-brand-textMuted">Tracking: <span className="font-mono text-brand-heading">{o.tracking_number}</span></p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
