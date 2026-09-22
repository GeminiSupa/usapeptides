'use client';
import { useState } from 'react';

export default function CustomerRetention({ data, customerId, authedFetch, onSaved }: {
  data: any; customerId: string; authedFetch: (path: string, init?: RequestInit) => Promise<Response>; onSaved: () => void;
}) {
  const [source, setSource] = useState(data.retention?.acquisition_source ?? '');
  const [notes, setNotes] = useState(data.retention?.notes ?? '');
  const [days, setDays] = useState(String(data.retention?.reorder_days ?? ''));
  const [after, setAfter] = useState(data.retention?.follow_up_after ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const summary = data.purchaseSummary;
  return <section className="space-y-4 border border-brand-border p-4 text-sm text-brand-body">
    <h3 className="font-display font-bold text-brand-heading">Purchasing and follow-ups</h3>
    <p>{summary?.paidOrders ?? 0} paid orders · ${Number(summary?.spent ?? 0).toFixed(2)} recorded spend · Last paid order: {summary?.lastOrderAt?.slice(0,10) || 'None'}</p>
    <p className="text-xs text-brand-textMuted">Figures reflect orders visible to you{summary?.historyLimited ? ' and are limited to the latest 200 orders' : ''}. Recorded spend is not profit and does not account for unrecorded partial refunds.</p>
    <p>{data.reorder ? `${data.reorder.status}: ${data.reorder.dueAt} · ${data.reorder.intervalDays}-day interval · ${data.reorder.basis} · ${data.reorder.confidence} confidence` : 'Not enough purchase history to estimate a reorder. Set a known purchasing interval below if available.'}</p>
    <h4 className="font-semibold">Frequently purchased products</h4>
    {(data.frequentlyPurchased ?? []).map((p: any, i: number) => <p key={i} className="text-xs">{p.name} · {p.quantity} units{p.reorder ? ` · Next estimated purchase ${p.reorder.dueAt}` : ' · No reliable interval yet'}</p>)}
    <h4 className="font-semibold">Saved shipping addresses</h4>
    {!data.addresses?.length && <p className="text-xs">No saved addresses.</p>}
    {(data.addresses ?? []).map((a: any) => <p key={a.id} className="text-xs">{a.label}{a.is_default ? ' (default)' : ''}: {[a.line1,a.line2,a.city,a.state,a.postal_code,a.country].filter(Boolean).join(', ')}</p>)}
    {!data.retentionReady && <p role="status" className="border border-action p-3">Run 0023_customer_retention.sql in Supabase to enable editing. Purchase history remains available.</p>}
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage('');
      try {
        const res = await authedFetch(`/api/admin/customers/${customerId}`, { method: 'POST', body: JSON.stringify({ acquisition_source: source, notes, reorder_days: days ? Number(days) : null, follow_up_after: after || null }) });
        const payload = await res.json(); if (!res.ok) throw new Error(payload.message || 'Save failed.');
        setMessage('Saved.'); onSaved();
      } catch (err) { setMessage(err instanceof Error ? err.message : 'Save failed.'); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={!data.retentionReady || busy} className="grid gap-3 sm:grid-cols-2">
        <label>Acquisition source<input className="field-input mt-1" maxLength={200} value={source} onChange={e=>setSource(e.target.value)} placeholder="Referral, event, search, sales outreach…" /></label>
        <label>Known purchasing interval (days)<input type="number" min={1} max={365} className="field-input mt-1" value={days} onChange={e=>setDays(e.target.value)} placeholder="Blank uses purchase history" /></label>
        <label>Hide from follow-up queue until<input type="date" className="field-input mt-1" value={after} onChange={e=>setAfter(e.target.value)} /></label>
        <label className="sm:col-span-2">Internal notes<textarea className="field-input mt-1" maxLength={5000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
        <button className="btn-primary" type="submit">{busy ? 'Saving…' : 'Save follow-up details'}</button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
