'use client';

import React, { useEffect, useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import UploadField, { type UploadKind } from './UploadField';

/**
 * Your own account: name, phone, photo and password.
 *
 * Deliberately narrow. Email, job title, role, permissions and pay are set by a
 * super admin in Users; the route behind this form ignores them even if they
 * are posted, so this cannot be used to promote yourself.
 */

export interface OwnProfile {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  onCancel: () => void;
  onSaved: (profile: OwnProfile) => void;
}

const input =
  'w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none';

const fieldError = (message?: string) =>
  message ? <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{message}</span> : null;

export default function ProfileModal({ authedFetch, upload, onCancel, onSaved }: Props) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [minPassword, setMinPassword] = useState(12);
  const [loadError, setLoadError] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwFields, setPwFields] = useState<Record<string, string>>({});
  const [pwNotice, setPwNotice] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const fill = (p: OwnProfile) => {
    setProfile(p);
    setFullName(p.full_name ?? '');
    setPhone(p.phone ?? '');
    setAvatar(p.avatar_url ?? '');
  };

  useEffect(() => {
    authedFetch('/api/admin/profile')
      .then(async (res) => {
        const p = await res.json().catch(() => null);
        if (!res.ok) { setLoadError(p?.message ?? 'Could not load your profile.'); return; }
        fill(p.data.profile);
        setMinPassword(p.data.minPassword ?? 12);
      })
      .catch((err) => setLoadError((err as Error).message === 'denied' ? 'Access denied.' : (err as Error).message));
  }, [authedFetch]);

  const save = async () => {
    if (!profile) return;
    const changes: Record<string, unknown> = {};
    if (fullName.trim() !== (profile.full_name ?? '')) changes.full_name = fullName;
    if (phone.trim() !== (profile.phone ?? '')) changes.phone = phone;
    if (avatar !== (profile.avatar_url ?? '')) changes.avatar_url = avatar;

    setError(''); setFields({}); setNotice('');
    if (Object.keys(changes).length === 0) { setNotice('Nothing has changed.'); return; }

    setBusy(true);
    try {
      const res = await authedFetch('/api/admin/profile', { method: 'PATCH', body: JSON.stringify(changes) });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save.'); setFields(p?.fields ?? {}); return; }
      fill(p.data.profile);
      onSaved(p.data.profile);
      setNotice('Saved.');
    } catch (err) {
      if ((err as Error).message !== 'denied') setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setPwError(''); setPwFields({}); setPwNotice('');
    if (next !== confirm) { setPwFields({ confirm: 'The two new passwords do not match.' }); return; }

    setPwBusy(true);
    try {
      const res = await authedFetch('/api/admin/profile/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setPwError(p?.message ?? 'Could not change your password.'); setPwFields(p?.fields ?? {}); return; }
      setCurrent(''); setNext(''); setConfirm('');
      setPwNotice(p?.data?.message ?? 'Password changed.');
    } catch (err) {
      if ((err as Error).message !== 'denied') setPwError((err as Error).message);
    } finally {
      setPwBusy(false);
    }
  };

  const tooShort = next.length > 0 && next.length < minPassword;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 py-8">
      <div className="mx-auto w-full max-w-lg border border-brand-border bg-brand-card">
        <div className="flex items-start justify-between border-b border-brand-border px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              My profile
            </h2>
            <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">{profile?.email ?? ' '}</p>
          </div>
          <button onClick={onCancel} className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadError ? (
          <p className="m-5 border border-brand-accent/50 bg-brand-dark p-3 text-[0.8125rem] text-brand-body">{loadError}</p>
        ) : !profile ? (
          <p className="p-5 text-xs text-brand-textMuted">Loading...</p>
        ) : (
          <>
            {/* -------------------------------------------------- about you */}
            <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="border-b border-brand-border p-5">
              <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">About you</h3>

              <div className="mb-4">
                <span className="eyebrow mb-1.5 block">Photo</span>
                <UploadField kind="avatar" value={avatar} onChange={setAvatar} upload={upload} />
                {fieldError(fields.avatar_url)}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow mb-1.5 block">Full name</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
                  {fieldError(fields.full_name)}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">Phone</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
                  {fieldError(fields.phone)}
                </label>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-4 text-[0.8125rem] sm:grid-cols-2">
                <div>
                  <dt className="eyebrow mb-1">Email</dt>
                  <dd className="truncate font-mono text-brand-body">{profile.email}</dd>
                </div>
                <div>
                  <dt className="eyebrow mb-1">Job title</dt>
                  <dd className="text-brand-body">{profile.job_title || '—'}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
                Your email, job title, access and pay are set by a super admin.
              </p>

              {error && <p className="mt-4 text-[0.8125rem] text-brand-accentGlow">{error}</p>}
              {notice && <p className="mt-4 text-[0.8125rem] text-whatsapp">{notice}</p>}

              <button type="submit" disabled={busy} className="btn-primary mt-4 w-full disabled:opacity-60">
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </form>

            {/* --------------------------------------------------- password */}
            <form onSubmit={(e) => { e.preventDefault(); void changePassword(); }} className="p-5">
              <h3 className="eyebrow mb-3 flex items-center gap-1.5 border-b border-brand-border pb-2">
                <KeyRound className="h-3 w-3" /> Change password
              </h3>

              <div className="space-y-4">
                <label className="block">
                  <span className="eyebrow mb-1.5 block">Current password</span>
                  <input type="password" autoComplete="current-password" value={current}
                    onChange={(e) => setCurrent(e.target.value)} className={input} />
                  {fieldError(pwFields.current_password)}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">New password</span>
                  <input type="password" autoComplete="new-password" value={next}
                    onChange={(e) => setNext(e.target.value)} placeholder={`At least ${minPassword} characters`} className={input} />
                  {fieldError(pwFields.new_password ?? (tooShort ? `${minPassword - next.length} more character${minPassword - next.length === 1 ? '' : 's'} needed.` : undefined))}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">New password again</span>
                  <input type="password" autoComplete="new-password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} className={input} />
                  {fieldError(pwFields.confirm)}
                </label>
              </div>

              {pwError && <p className="mt-4 text-[0.8125rem] text-brand-accentGlow">{pwError}</p>}
              {pwNotice && <p className="mt-4 text-[0.8125rem] text-whatsapp">{pwNotice}</p>}

              <button
                type="submit"
                disabled={pwBusy || !current || next.length < minPassword || !confirm}
                className="btn-ghost mt-4 w-full disabled:opacity-60"
              >
                {pwBusy ? 'Changing...' : 'Change password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
