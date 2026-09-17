'use client';

import React, { useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react';
import { PRODUCT_SHEET_FIELDS, mapSheetRow, productToCells } from '@/lib/productSheet';
import { exportSheet, readSpreadsheet, stamp, type SheetFormat } from '@/lib/sheetFiles';

/**
 * Products: export the catalogue as CSV, Excel or PDF, and import a CSV or
 * Excel file.
 *
 * Import is two steps on purpose. The file is checked on the server first and
 * every row is shown as "add", "update", "skip" or "problem"; nothing is
 * written until the person has seen that and pressed Import.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface RowResult {
  line: number;
  action: 'create' | 'update' | 'skip' | 'error';
  name: string;
  sku: string | null;
  messages: string[];
}

interface Outcome {
  dryRun: boolean;
  summary: { create: number; update: number; skip: number; error: number; newCategories: string[] };
  results: RowResult[];
}

const FORMATS: { id: SheetFormat; label: string; icon: typeof FileText }[] = [
  { id: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { id: 'csv', label: 'CSV (.csv)', icon: FileSpreadsheet },
  { id: 'pdf', label: 'PDF price list', icon: FileText },
];

const ACTION_LABEL: Record<RowResult['action'], string> = {
  create: 'Add',
  update: 'Update',
  skip: 'Skip',
  error: 'Problem',
};

const ACTION_STYLE: Record<RowResult['action'], string> = {
  create: 'bg-brand-accent text-brand-onAccent',
  update: 'bg-navy text-cream',
  skip: 'border border-brand-borderLight text-brand-textMuted',
  error: 'bg-action text-white',
};

export default function ProductImportExport({ authedFetch, onImported }: { authedFetch: Fetcher; onImported: () => void }) {
  const [menu, setMenu] = useState<'export' | 'template' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [mode, setMode] = useState<'upsert' | 'create'>('upsert');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [filter, setFilter] = useState<'all' | RowResult['action']>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async (format: SheetFormat) => {
    setMenu(null); setError(''); setBusy('Preparing the file...');
    try {
      const res = await authedFetch('/api/admin/products/import');
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not read the catalogue.');
      const products = p.data.products as Record<string, unknown>[];
      const fields = format === 'pdf' ? PRODUCT_SHEET_FIELDS.filter((f) => f.inPdf) : PRODUCT_SHEET_FIELDS;
      await exportSheet(format, {
        filename: `products-${stamp()}`,
        title: 'Product catalogue',
        headers: fields.map((f) => f.header),
        rows: products.map((row) => productToCells(row, fields)),
      }, `${products.length} products · exported ${new Date().toLocaleString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally { setBusy(''); }
  };

  const doTemplate = async (format: 'csv' | 'xlsx') => {
    setMenu(null);
    const example: Record<string, unknown> = {
      name: 'Example Peptide 10mg', sku: 'EX-10', category: 'Laboratory Solvents and Supplies',
      price: 49.99, sale_price: '', stock_count: 25, purity: '99%', is_active: true,
      description: 'Delete this example row before importing.',
    };
    await exportSheet(format, {
      filename: 'product-import-template',
      title: 'Products',
      headers: PRODUCT_SHEET_FIELDS.map((f) => f.header),
      rows: [productToCells(example)],
    });
  };

  const check = async (nextRows: Record<string, unknown>[], nextMode = mode) => {
    setBusy('Checking every row...'); setError('');
    try {
      const res = await authedFetch('/api/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ rows: nextRows, mode: nextMode, dryRun: true }),
      });
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not check the file.');
      setOutcome(p.data);
    } catch (err) {
      setOutcome(null);
      setError(err instanceof Error ? err.message : 'Could not check the file.');
    } finally { setBusy(''); }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(''); setOutcome(null); setFilter('all'); setFileName(file.name);
    setBusy('Reading the file...');
    try {
      const raw = await readSpreadsheet(file);
      if (raw.length === 0) throw new Error('The file has headings but no product rows.');
      const headers = Object.keys(raw[0] ?? {});
      const mapped = raw.map(mapSheetRow);
      setUnmatched(headers.filter((h) => !Object.keys(mapSheetRow({ [h]: 1 })).length));
      if (!mapped.some((r) => r.name || r.sku)) {
        throw new Error('No column called Name or SKU was found. Download the template to see the headings we read.');
      }
      setRows(mapped);
      await check(mapped);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not read that file.');
      setBusy('');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const commit = async () => {
    setBusy('Importing...'); setError('');
    try {
      const res = await authedFetch('/api/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ rows, mode, dryRun: false }),
      });
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Import failed.');
      setOutcome(p.data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally { setBusy(''); }
  };

  const close = () => {
    setOpen(false); setRows([]); setOutcome(null); setFileName(''); setError(''); setUnmatched([]);
  };

  const shown = outcome?.results.filter((r) => filter === 'all' || r.action === filter) ?? [];
  const writable = outcome ? outcome.summary.create + outcome.summary.update : 0;

  const dropdown = (kind: 'export' | 'template', label: string, icon: React.ReactNode, items: { id: string; label: string }[], onPick: (id: string) => void) => (
    <div className="relative">
      <button onClick={() => setMenu(menu === kind ? null : kind)} className="btn-secondary" disabled={Boolean(busy)} aria-expanded={menu === kind}>
        {icon} {label} <ChevronDown className="h-3 w-3" />
      </button>
      {menu === kind && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} />
          <div className="absolute right-0 z-40 mt-1 w-48 border border-brand-border bg-brand-card py-1">
            {items.map((item) => (
              <button key={item.id} onClick={() => onPick(item.id)}
                className="block w-full px-3 py-2 text-left text-xs text-brand-body hover:bg-brand-dark hover:text-brand-heading">
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {dropdown('export', 'Export', <Download className="h-3.5 w-3.5" />, FORMATS, (id) => void doExport(id as SheetFormat))}
        <button onClick={() => setOpen(true)} className="btn-secondary" disabled={Boolean(busy)}>
          <Upload className="h-3.5 w-3.5" /> Import
        </button>
        {busy && !open && <span className="flex items-center gap-1.5 text-[0.75rem] text-brand-textMuted"><Loader2 className="h-3 w-3 animate-spin" /> {busy}</span>}
        {error && !open && <span className="text-[0.75rem] text-action">{error}</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Import products">
          <div className="mx-auto max-w-5xl border border-brand-border bg-brand-card">
            <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">Import products</h2>
              <button onClick={close} aria-label="Close" className="p-1 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2 text-[0.8125rem] leading-relaxed text-brand-body">
                  <p>
                    Pick a <strong>CSV</strong> or <strong>Excel (.xlsx)</strong> file with one product per row. We read
                    common headings in English and Spanish (Name / Nombre, Price / Precio, Stock / Cantidad…).
                  </p>
                  <p className="text-brand-textMuted">
                    A row that has the same SKU or web address as an existing product updates it. Empty cells leave the
                    current value alone. New categories are created for you. Photo and certificate links from other
                    websites are not copied — upload those on the product.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {dropdown('template', 'Blank template', <FileSpreadsheet className="h-3.5 w-3.5" />,
                    [{ id: 'xlsx', label: 'Excel template' }, { id: 'csv', label: 'CSV template' }],
                    (id) => void doTemplate(id as 'csv' | 'xlsx'))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4 border border-brand-border bg-brand-dark p-4">
                <label className="min-w-0 flex-1">
                  <span className="field-label">File</span>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => void pick(e.target.files?.[0])}
                    className="block w-full text-xs text-brand-body file:mr-3 file:border file:border-brand-borderLight file:bg-brand-card file:px-3 file:py-2 file:font-display file:text-[0.75rem] file:font-extrabold file:uppercase file:text-brand-heading" />
                </label>
                <label>
                  <span className="field-label">When a product already exists</span>
                  <select value={mode} className="field-input"
                    onChange={(e) => { const next = e.target.value as 'upsert' | 'create'; setMode(next); if (rows.length) void check(rows, next); }}>
                    <option value="upsert">Update it with the file</option>
                    <option value="create">Leave it alone, only add new ones</option>
                  </select>
                </label>
              </div>

              {busy && <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}</p>}
              {error && <p className="border border-action/50 bg-brand-dark p-3 text-xs text-brand-body">{error}</p>}

              {unmatched.length > 0 && outcome && (
                <p className="text-[0.75rem] text-brand-textMuted">
                  Columns we did not recognise and will ignore: {unmatched.join(', ')}
                </p>
              )}

              {outcome && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-2 font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">
                      {outcome.dryRun ? `Preview of ${fileName}` : 'Import finished'}
                    </span>
                    {(['all', 'create', 'update', 'skip', 'error'] as const).map((key) => {
                      const count = key === 'all' ? outcome.results.length : outcome.summary[key];
                      return (
                        <button key={key} onClick={() => setFilter(key)}
                          className={`chip ${filter === key ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-body'}`}>
                          {key === 'all' ? 'All' : ACTION_LABEL[key]} {count}
                        </button>
                      );
                    })}
                  </div>

                  {outcome.summary.newCategories.length > 0 && (
                    <p className="text-[0.75rem] text-brand-body">
                      New categories: <strong>{outcome.summary.newCategories.join(', ')}</strong>
                    </p>
                  )}

                  <div className="max-h-[45vh] overflow-auto border border-brand-border">
                    <table className="w-full min-w-[40rem] text-left text-xs">
                      <thead className="sticky top-0 border-b border-brand-border bg-brand-card">
                        <tr>
                          {['Row', 'Result', 'Product', 'SKU', 'Notes'].map((h) => (
                            <th key={h} className="px-3 py-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r) => (
                          <tr key={r.line} className="border-b border-brand-border/60 align-top last:border-b-0">
                            <td className="px-3 py-2 font-mono text-brand-textMuted">{r.line}</td>
                            <td className="px-3 py-2"><span className={`chip ${ACTION_STYLE[r.action]}`}>{ACTION_LABEL[r.action]}</span></td>
                            <td className="px-3 py-2 font-semibold text-brand-heading">{r.name || '—'}</td>
                            <td className="px-3 py-2 font-mono text-brand-body">{r.sku || '—'}</td>
                            <td className="px-3 py-2 text-brand-body">{r.messages.join(' ') || '—'}</td>
                          </tr>
                        ))}
                        {shown.length === 0 && (
                          <tr><td colSpan={5} className="p-6 text-center text-brand-textMuted">Nothing in this group.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-brand-border px-5 py-4">
              {outcome?.dryRun && outcome.summary.error > 0 && (
                <span className="mr-auto text-[0.75rem] text-brand-textMuted">
                  Rows marked Problem will be left out. Fix them in the file and import again if you need them.
                </span>
              )}
              <button onClick={close} className="btn-secondary">{outcome && !outcome.dryRun ? 'Done' : 'Cancel'}</button>
              {outcome?.dryRun && (
                <button onClick={() => void commit()} disabled={Boolean(busy) || writable === 0}
                  className="btn-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                  Import {writable} product{writable === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
