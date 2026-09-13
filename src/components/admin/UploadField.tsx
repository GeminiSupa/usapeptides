'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, X, ExternalLink } from 'lucide-react';

/**
 * Pick a file, send it to /api/admin/upload, keep the URL it returns.
 *
 * The upload happens as soon as a file is chosen rather than on save, so the
 * person sees the picture they picked before committing to the record, and a
 * file that is too large is refused there and then instead of after filling in
 * the rest of the form.
 */

export type UploadKind = 'image' | 'coa' | 'avatar';

interface Props {
  kind: UploadKind;
  value: string;
  onChange: (url: string) => void;
  upload: (file: File, kind: UploadKind) => Promise<string>;
}

const ACCEPT: Record<UploadKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml',
  coa: 'application/pdf',
  // No SVG: a profile photo is shown to other staff, and an SVG can carry script.
  avatar: 'image/jpeg,image/png,image/webp,image/avif',
};

export default function UploadField({ kind, value, onChange, upload }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await upload(file, kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      // Cleared so picking the same file again still fires a change event.
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center border border-brand-border bg-brand-dark">
          {value ? (
            kind !== 'coa' ? (
              <img src={value} alt="" className={`h-full w-full ${kind === 'avatar' ? 'object-cover' : 'object-contain p-1'}`} />
            ) : (
              <FileText className="h-5 w-5 text-brand-accentGlow" />
            )
          ) : (
            <span className="text-[0.6875rem] uppercase tracking-wider text-brand-textMuted">
              none
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="inline-flex items-center gap-1.5 border border-brand-borderLight px-2.5 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow disabled:opacity-60"
            >
              <Upload className="h-3 w-3" />
              {busy ? 'Uploading...' : value ? 'Replace' : kind === 'coa' ? 'Upload PDF' : 'Upload'}
            </button>

            {value && (
              <>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-brand-borderLight px-2.5 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                >
                  <ExternalLink className="h-3 w-3" /> View
                </a>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  title="Remove from this record"
                  className="inline-flex items-center gap-1.5 border border-brand-borderLight px-2.5 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              </>
            )}
          </div>

          {value && (
            <p className="mt-1.5 truncate font-mono text-[0.6875rem] text-brand-textMuted">
              {value.split('/').pop()}
            </p>
          )}
          {error && <p className="mt-1.5 text-[0.75rem] text-brand-accentGlow">{error}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT[kind]}
        hidden
        onChange={(e) => void choose(e.target.files?.[0])}
      />
    </div>
  );
}
