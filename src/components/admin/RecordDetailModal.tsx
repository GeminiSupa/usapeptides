'use client';

import { useEffect } from 'react';
import { Mail, Pencil, Phone, Trash2, X } from 'lucide-react';
import type { FieldDef } from './RecordEditor';
import { useModalDismiss } from './useModalDismiss';

/**
 * The read-only profile behind a row in the generic table: every column the
 * API returned, in plain words, with the actions for that record.
 *
 * The table itself can only ever show a handful of columns before it needs
 * sideways scrolling, so a lead's goal, comments and tracking number were
 * reachable only by opening the edit form - and the edit form does not carry
 * the columns nobody may type into. This does.
 */

interface Props {
  title: string;
  row: Record<string, any>;
  /** Field definitions, used for labels and ordering when the API sent them. */
  fields?: FieldDef[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Bookkeeping the profile has no reason to show. */
const HIDDEN = new Set(['id', 'password', 'password_hash']);

const prettify = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const isMoney = (k: string) => k.includes('total') || k.includes('price') || k === 'amount';

const display = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  if (key.endsWith('_at') || key.endsWith('_on')) {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }
  if (isMoney(key)) return `$${Number(value).toFixed(2)}`;
  return String(value);
};

/** A phone number a `tel:` or `wa.me` link can use, or '' when there is none. */
const dialable = (value: unknown): string => {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  return digits.length >= 7 ? digits : '';
};

export default function RecordDetailModal({
  title, row, fields, canEdit, canDelete, onEdit, onDelete, onClose,
}: Props) {
  const dismiss = useModalDismiss(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const labels = new Map((fields ?? []).map((f) => [f.name, f.label]));
  // Declared fields first, in the order the resource declared them, then
  // everything else the row carries, so a column added by a later migration
  // still shows up without being listed anywhere.
  const ordered = [
    ...(fields ?? []).map((f) => f.name).filter((k) => k in row),
    ...Object.keys(row).filter((k) => !labels.has(k)),
  ].filter((k) => !HIDDEN.has(k));

  const heading = String(row.full_name || row.name || row.label || row.email || prettify(title));
  const phone = dialable(row.phone ?? row.tracking_phone);
  const email = String(row.email ?? '').trim();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 py-8" {...dismiss}>
      <div className="mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto border border-brand-border bg-brand-card [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-brand-border bg-brand-card px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">{heading}</h2>
            <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">{title} record</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        {(phone || email) && (
          <div className="flex flex-wrap gap-2 border-b border-brand-border px-5 py-3">
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex min-h-9 items-center gap-1.5 border border-brand-borderLight px-3 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
                <Phone className="h-3 w-3" /> Call
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 bg-whatsapp px-3 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-whatsapp-ink">
                WhatsApp
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="inline-flex min-h-9 items-center gap-1.5 border border-brand-borderLight px-3 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
                <Mail className="h-3 w-3" /> Email
              </a>
            )}
          </div>
        )}

        <dl className="divide-y divide-brand-border/60 px-5">
          {ordered.map((k) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted">
                {labels.get(k) ?? prettify(k)}
              </dt>
              <dd className="whitespace-pre-wrap break-words text-xs leading-relaxed text-brand-body">{display(k, row[k])}</dd>
            </div>
          ))}
        </dl>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-brand-border bg-brand-card px-5 py-4">
          {canEdit && (
            <button onClick={onEdit} className="btn-primary flex-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">Close</button>
          {canDelete && (
            <button onClick={onDelete} aria-label="Delete"
              className="inline-flex min-h-10 min-w-10 items-center justify-center border border-brand-borderLight text-brand-textMuted transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
