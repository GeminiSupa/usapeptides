'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'money' | 'boolean' | 'select' | 'date' | 'textarea';
  options?: string[];
  required?: boolean;
  help?: string;
}

interface Props {
  title: string;
  fields: FieldDef[];
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

/** Form for creating a record, built from the resource's field definitions. */
export default function NewRecordModal({
  title, fields, busy, error, fieldErrors, onCancel, onSubmit,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'boolean') initial[f.name] = false;
      else if (f.type === 'select' && f.options?.length) initial[f.name] = f.options[0];
      else initial[f.name] = '';
    }
    return initial;
  });

  const set = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const inputClass =
    'w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10">
      <div className="w-full max-w-lg border border-brand-border bg-brand-card">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
            New {title}
          </h2>
          <button onClick={onCancel} className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
          className="space-y-4 p-5"
        >
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="eyebrow mb-1.5 block">
                {f.label}
                {f.required && <span className="ml-1 text-brand-accent">*</span>}
              </span>

              {f.type === 'boolean' ? (
                <button
                  type="button"
                  onClick={() => set(f.name, !values[f.name])}
                  className={`px-3 py-1.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] transition-colors ${
                    values[f.name]
                      ? 'bg-brand-accent text-white'
                      : 'border border-brand-borderLight text-brand-textMuted'
                  }`}
                >
                  {values[f.name] ? 'Yes' : 'No'}
                </button>
              ) : f.type === 'select' ? (
                <select
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputClass}
                >
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputClass}
                />
              ) : (
                <input
                  type={
                    f.type === 'email' ? 'email'
                    : f.type === 'date' ? 'date'
                    : f.type === 'number' || f.type === 'money' ? 'number'
                    : 'text'
                  }
                  step={f.type === 'money' ? '0.01' : undefined}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={inputClass}
                />
              )}

              {f.help && (
                <span className="mt-1 block text-[0.625rem] text-brand-textMuted">{f.help}</span>
              )}
              {fieldErrors[f.name] && (
                <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">
                  {fieldErrors[f.name]}
                </span>
              )}
            </label>
          ))}

          {error && <p className="text-[0.6875rem] text-brand-accentGlow">{error}</p>}

          <div className="flex gap-2 border-t border-brand-border pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? 'Saving...' : 'Save'}
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
