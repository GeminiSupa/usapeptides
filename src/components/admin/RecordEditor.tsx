'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import UploadField, { type UploadKind } from './UploadField';

/**
 * One form for adding and for editing a record, built from the field
 * definitions the API hands back.
 *
 * Replaces the earlier create-only modal. Editing used to be a chain of
 * `window.prompt` calls, one per column, which is why adding a product with an
 * image and a certificate was not possible at all: a prompt cannot hold a file.
 *
 * Fields carrying a `group` are rendered under that heading, in the order the
 * groups first appear. Anything ungrouped falls into a single section, so a
 * resource that never declared groups still renders as one plain form.
 */

export interface FieldDef {
  name: string;
  label: string;
  type:
    | 'text' | 'email' | 'number' | 'money' | 'boolean'
    | 'select' | 'date' | 'textarea' | 'image' | 'file';
  options?: string[];
  required?: boolean;
  help?: string;
  group?: string;
}

interface Props {
  title: string;
  fields: FieldDef[];
  /** Existing row when editing; absent when adding. */
  initial?: Record<string, unknown> | null;
  /** In edit mode, the columns the API will accept. Others are shown greyed. */
  editable?: string[];
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

const inputClass =
  'w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none disabled:opacity-50';

/** Date columns come back as ISO or YYYY-MM-DD; the input needs the latter. */
const asDateInput = (v: unknown): string => {
  const text = String(v ?? '');
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

export default function RecordEditor({
  title, fields, initial, editable, busy, error, fieldErrors, upload, onCancel, onSubmit,
}: Props) {
  const editing = Boolean(initial);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const existing = initial?.[f.name];

      if (f.type === 'boolean') {
        out[f.name] = editing ? Boolean(existing) : false;
      } else if (f.type === 'date') {
        out[f.name] = asDateInput(existing);
      } else if (f.type === 'select' && !editing) {
        out[f.name] = f.options?.length && f.required ? f.options[0] : '';
      } else {
        out[f.name] = existing == null ? '' : String(existing);
      }
    }
    return out;
  });

  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  // Escape closes it. Without this the only way out of a long form was to
  // scroll to the bottom and find Cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  /** Groups in the order they first appear, so the form reads top to bottom. */
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, FieldDef[]>();
    for (const f of fields) {
      const key = f.group ?? '';
      if (!byGroup.has(key)) { byGroup.set(key, []); order.push(key); }
      byGroup.get(key)!.push(f);
    }
    return order.map((key) => ({ key, fields: byGroup.get(key)! }));
  }, [fields]);

  /** Editing only sends what the API will accept, and only what changed. */
  const submit = () => {
    if (!editing) { onSubmit(values); return; }

    const changes: Record<string, unknown> = {};
    for (const f of fields) {
      if (editable && !editable.includes(f.name)) continue;

      const next = values[f.name];
      const before =
        f.type === 'boolean' ? Boolean(initial?.[f.name])
        : f.type === 'date' ? asDateInput(initial?.[f.name])
        : initial?.[f.name] == null ? '' : String(initial[f.name]);

      if (String(next) !== String(before)) {
        // An emptied text box means "clear this column", which is null rather
        // than an empty string so numeric and date columns stay valid.
        changes[f.name] = next === '' ? null : next;
      }
    }
    onSubmit(changes);
  };

  const field = (f: FieldDef) => {
    const locked = editing && Boolean(editable) && !editable!.includes(f.name);
    const value = values[f.name];

    if (f.type === 'boolean') {
      return (
        <button
          type="button"
          disabled={locked}
          onClick={() => set(f.name, !value)}
          className={`px-3 py-1.5 font-display text-[0.75rem] font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${
            value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
          }`}
        >
          {value ? 'Yes' : 'No'}
        </button>
      );
    }

    if (f.type === 'image' || f.type === 'file') {
      return (
        <UploadField
          kind={f.type === 'image' ? 'image' : 'coa'}
          value={String(value ?? '')}
          onChange={(url) => set(f.name, url)}
          upload={upload}
        />
      );
    }

    if (f.type === 'select') {
      return (
        <select
          disabled={locked}
          value={String(value ?? '')}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputClass}
        >
          {!f.required && <option value="">— none —</option>}
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (f.type === 'textarea') {
      return (
        <textarea
          rows={3}
          disabled={locked}
          value={String(value ?? '')}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputClass}
        />
      );
    }

    return (
      <input
        disabled={locked}
        type={
          f.type === 'email' ? 'email'
          : f.type === 'date' ? 'date'
          : f.type === 'number' || f.type === 'money' ? 'number'
          : 'text'
        }
        step={f.type === 'money' ? '0.01' : undefined}
        min={f.type === 'money' || f.type === 'number' ? '0' : undefined}
        value={String(value ?? '')}
        onChange={(e) => set(f.name, e.target.value)}
        className={inputClass}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 py-8">
      <div className="mx-auto w-full max-w-2xl border border-brand-border bg-brand-card">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-border bg-brand-card px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              {editing ? `Edit ${title.toLowerCase()}` : `New ${title.toLowerCase()}`}
            </h2>
            {editing && (
              <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">
                Only what you change is saved.
              </p>
            )}
          </div>
          <button onClick={onCancel} className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="p-5">
          {groups.map((group) => (
            <section key={group.key} className="mb-6 last:mb-0">
              {group.key && (
                <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">{group.key}</h3>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.fields.map((f) => (
                  <label
                    key={f.name}
                    className={`block ${
                      f.type === 'textarea' || f.type === 'image' || f.type === 'file'
                        ? 'sm:col-span-2'
                        : ''
                    }`}
                  >
                    <span className="eyebrow mb-1.5 block">
                      {f.label}
                      {f.required && !editing && <span className="ml-1 text-brand-accent">*</span>}
                    </span>
                    {field(f)}
                    {f.help && (
                      <span className="mt-1 block text-[0.75rem] leading-relaxed text-brand-textMuted">
                        {f.help}
                      </span>
                    )}
                    {fieldErrors[f.name] && (
                      <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">
                        {fieldErrors[f.name]}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}

          {error && (
            <p className="mb-4 border border-brand-accent/50 bg-brand-dark p-3 text-[0.8125rem] text-brand-body">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 flex gap-2 border-t border-brand-border bg-brand-card pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? 'Saving...' : editing ? 'Save changes' : `Add ${title.toLowerCase()}`}
            </button>
            <button type="button" onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
