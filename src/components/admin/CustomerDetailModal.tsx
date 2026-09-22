'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';
import CustomerRetention from './CustomerRetention';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;

export default function CustomerDetailModal({ customerId, authedFetch, isAgent, onClose, onChanged }: {
  customerId: string; authedFetch: Fetcher; isAgent: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [owner, setOwner] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authedFetch(`/api/admin/customers/${customerId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? 'Could not load the customer profile.');
      setData(payload.data); setOwner(String(payload.data.customer.owner_id ?? ''));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load the customer profile.'); }
    finally { setLoading(false); }
  }, [authedFetch, customerId]);
  useEffect(() => { void load(); }, [load]);

  const ownerChanged = Boolean(data?.ownershipReady && owner !== String(data?.customer?.owner_id ?? ''));
  const saveOwner = async () => {
    setSaving(true); setError('');
    try {
      const res = await authedFetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH', body: JSON.stringify({ owner_id: owner || null, confirmed: true }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? 'Could not change customer ownership.');
      setConfirming(false); onChanged(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not change customer ownership.'); setConfirming(false); }
    finally { setSaving(false); }
  };

  const pageHistory = useMemo(() => {
    const rows: { when: string; path: string; action: string }[] = [];
    for (const visit of data?.visits ?? []) for (const event of visit.events ?? []) rows.push({
      when: event.created_at,
      path: event.product_slug ? `${event.path || '/'} · ${event.product_slug}` : event.path || '/',
      action: event.event_name === 'interaction' && event.payload?.label ? `clicked ${event.payload.label}` : event.event_name,
    });
    return rows.sort((a, b) => b.when.localeCompare(a.when));
  }, [data]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Customer profile">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto border border-brand-border bg-brand-card">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-brand-border bg-brand-card px-5 py-4">
          <div><p className="eyebrow">Customer profile</p><h2 className="mt-1 font-display text-lg font-black text-brand-heading">{data?.customer?.full_name || data?.customer?.email || 'Customer'}</h2></div>
          <button onClick={onClose} aria-label="Close customer profile" className="p-2 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
        </header>
        {loading ? <p className="flex items-center gap-2 p-8 text-xs text-brand-textMuted"><Loader2 className="h-4 w-4 animate-spin"/> Loading customer history…</p> : error && !data ? <p className="m-5 border border-action/50 p-4 text-xs">{error}</p> : data && (
          <div className="space-y-5 p-5">
            <CustomerRetention data={data} customerId={customerId} authedFetch={authedFetch} onSaved={() => { onChanged(); void load(); }} />
            {error && <p className="border border-action/50 p-3 text-xs text-brand-body">{error}</p>}
            {!data.ownershipReady && <p className="border border-action/50 bg-brand-dark p-3 text-xs text-brand-body">Customer ownership needs <strong>supabase/migrations/0019_customer_ownership.sql</strong>. History still works, but the original sales agent cannot be changed until it is run.</p>}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Section title="Contact"><Info label="Email" value={data.customer.email}/><Info label="Phone" value={data.customer.phone}/><Info label="Institution" value={data.customer.institution}/><Info label="Customer since" value={data.customer.created_at ? new Date(data.customer.created_at).toLocaleDateString() : null}/><Info label="Shop sign-in" value={data.customer.user_id ? 'Enabled' : 'Not enabled'}/></Section>
              <Section title="Original sales agent">
                {isAgent ? <Info label="Owner" value={data.customer.owner_id ? 'You' : 'Unassigned'} /> : (
                  <><label className="block"><span className="eyebrow mb-1.5 block">Customer owner</span><select disabled={!data.ownershipReady} className="field-input" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Unassigned</option>{data.owners.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}{data.customer.owner_id && !data.owners.some((person: any) => person.id === data.customer.owner_id) && <option value={data.customer.owner_id}>Former agent</option>}</select></label><button disabled={!ownerChanged} onClick={() => setConfirming(true)} className="btn-primary mt-3 px-3 py-2 disabled:opacity-40"><Save className="h-3.5 w-3.5"/> Change owner</button><p className="mt-2 text-[0.6875rem] leading-relaxed text-brand-textMuted">This changes future and open orders. Completed-order commission history is kept.</p></>
                )}
              </Section>
              <Section title="Summary"><Info label="Orders" value={data.orders.length}/><Info label="Completed" value={data.orders.filter((order: any) => order.status === 'completed').length}/><Info label="Recorded visits" value={data.visits.length}/><Info label="Recorded page actions" value={pageHistory.length}/></Section>
            </div>

            <Section title="Order history">
              {data.orders.length === 0 ? <p className="text-brand-textMuted">No visible orders.</p> : <div className="space-y-3">{data.orders.map((order: any) => <div key={order.id} className="border-t border-brand-border pt-3 first:border-t-0 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="font-mono text-brand-heading">{order.order_number}</strong><span className="ml-2 capitalize text-brand-textMuted">{order.status === 'completed' ? 'Order completed' : order.status}</span></div><span className="font-mono text-brand-heading">{money(order.grand_total)}</span></div><p className="mt-1 text-[0.6875rem] text-brand-textMuted">{new Date(order.created_at).toLocaleString()}{order.tracking_number ? ` · Tracking ${order.tracking_number}` : ''}</p><ul className="mt-2 space-y-1">{order.items.map((item: any) => <li key={item.id} className="flex justify-between gap-3"><span>{item.product_name} × {item.quantity}</span><span className="font-mono">{money(item.line_total)}</span></li>)}</ul></div>)}</div>}
            </Section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="Pages and products viewed">
                {pageHistory.length === 0 ? <p className="text-brand-textMuted">No browsing history is linked yet. A visit is linked when it leads to an order.</p> : <div className="max-h-80 overflow-auto">{pageHistory.slice(0, 200).map((entry, index) => <div key={`${entry.when}-${index}`} className="flex justify-between gap-3 border-t border-brand-border py-2 first:border-t-0"><div><p className="break-all text-brand-heading">{entry.path}</p><p className="capitalize text-[0.6875rem] text-brand-textMuted">{entry.action.replace(/_/g, ' ')}</p></div><span className="whitespace-nowrap font-mono text-[0.6875rem] text-brand-textMuted">{new Date(entry.when).toLocaleString()}</span></div>)}</div>}
              </Section>
              <Section title="Customer activity notes">
                {data.activity.length === 0 ? <p className="text-brand-textMuted">No customer notes yet.</p> : data.activity.map((entry: any) => <div key={entry.id} className="border-t border-brand-border py-2 first:border-t-0"><div className="flex justify-between gap-3"><strong className="capitalize text-brand-heading">{entry.activity?.replace(/_/g, ' ')}</strong><span className="font-mono text-[0.6875rem] text-brand-textMuted">{new Date(entry.created_at).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap">{entry.body || '—'}</p></div>)}
              </Section>
            </div>
          </div>
        )}
      </div>
      {confirming && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-modal="true"><div className="w-full max-w-md border border-brand-border bg-brand-card p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-action"/><div><h3 className="font-display text-sm font-black uppercase text-brand-heading">Change original sales agent?</h3><p className="mt-2 text-xs leading-relaxed text-brand-body">This is sensitive because the owner receives commission when future orders are completed. Open orders will move to the new owner; completed commission history will not be rewritten.</p></div></div><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button><button className="btn-primary px-4 py-2" disabled={saving} onClick={() => void saveOwner()}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin"/>} Confirm change</button></div></div></div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-brand-border bg-brand-dark p-4 text-xs"><h3 className="mb-3 font-display text-xs font-black uppercase tracking-[0.1em] text-brand-heading">{title}</h3>{children}</section>; }
function Info({ label, value }: { label: string; value: unknown }) { return <div className="flex justify-between gap-4 border-t border-brand-border py-2 first:border-t-0"><span className="text-brand-textMuted">{label}</span><span className="max-w-[65%] break-words text-right text-brand-heading">{value == null || value === '' ? '—' : String(value)}</span></div>; }
