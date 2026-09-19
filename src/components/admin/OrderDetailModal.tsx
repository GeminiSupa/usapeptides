'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
const statusLabel = (status: string) => status === 'completed' ? 'Order completed' : status.replace(/_/g, ' ');

interface Ownership {
  column: string; you: string; canClaim: boolean; canAssign: boolean;
  people: { id: string; name: string }[];
}

export default function OrderDetailModal({ row, detail, error, ownership, onClose, onSave }: {
  row: Record<string, any>;
  detail?: { order?: Record<string, any>; items?: Record<string, any>[]; fulfillment?: Record<string, any> | null; activity?: Record<string, any>[] };
  error?: string;
  ownership?: Ownership | null;
  onClose: () => void;
  onSave: (id: string, changes: Record<string, unknown>, ownerId?: string | null) => Promise<boolean>;
}) {
  const order = detail?.order ?? row;
  const items = detail?.items ?? [];
  const address = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : null;
  const [draft, setDraft] = useState({ status: '', tracking_number: '', payment_reference: '', notes: '', owner_id: '' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDraft({
      status: String(order.status ?? 'pending'), tracking_number: String(order.tracking_number ?? ''),
      payment_reference: String(order.payment_reference ?? ''), notes: String(order.notes ?? ''),
      owner_id: String(order.referred_by ?? ''),
    });
    setSaveError(''); setConfirming(false);
  }, [order.id, order.status, order.tracking_number, order.payment_reference, order.notes, order.referred_by]);

  const owner = String(order.referred_by ?? '');
  const canEdit = !ownership || ownership.canAssign || !ownership.canClaim || owner === ownership.you;
  const dirty = useMemo(() => Boolean(detail) && (
    draft.status !== String(order.status ?? 'pending')
    || draft.tracking_number !== String(order.tracking_number ?? '')
    || draft.payment_reference !== String(order.payment_reference ?? '')
    || draft.notes !== String(order.notes ?? '')
    || Boolean(ownership?.canAssign && draft.owner_id !== owner)
  ), [detail, draft, order, owner, ownership]);

  const save = async () => {
    setBusy(true); setSaveError('');
    const changes: Record<string, unknown> = {};
    for (const key of ['status', 'tracking_number', 'payment_reference', 'notes'] as const) {
      const before = String(order[key] ?? (key === 'status' ? 'pending' : ''));
      if (draft[key] !== before) changes[key] = draft[key];
    }
    const ownerChanged = Boolean(ownership?.canAssign && draft.owner_id !== owner);
    const ok = await onSave(order.id, changes, ownerChanged ? draft.owner_id || null : undefined);
    setBusy(false);
    if (!ok) { setConfirming(false); setSaveError('The order was not saved. Check the message above the table and try again.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Order details">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto border border-brand-border bg-brand-card [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-brand-border bg-brand-card px-5 py-4">
          <div><div className="eyebrow">Order</div><h2 className="mt-1 font-display text-lg font-black text-brand-heading">{order.order_number}</h2><p className="mt-1 text-xs text-brand-textMuted">Placed {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</p></div>
          <div className="flex items-center gap-2">
            {canEdit && <button type="button" disabled={!dirty || busy} onClick={() => setConfirming(true)} className="btn-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes</button>}
            <button onClick={onClose} aria-label="Close order details" className="p-2 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
          </div>
        </header>

        {error ? <p className="m-5 border border-brand-accent/50 p-4 text-xs">{error}</p> : !detail ? <p className="p-8 text-center text-xs text-brand-textMuted">Loading complete order details...</p> : (
          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              {!canEdit && <p className="border border-brand-border bg-brand-dark p-3 text-xs text-brand-textMuted">Claim this unassigned order before editing it.</p>}
              {saveError && <p className="border border-action/50 p-3 text-xs text-brand-body">{saveError}</p>}
              <Section title="Items">
                {items.length === 0 ? <p className="text-brand-textMuted">No line items found.</p> : items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-brand-border py-3 text-xs first:border-t-0"><div><strong className="text-brand-heading">{item.product_name}</strong><p className="mt-1 font-mono text-brand-textMuted">{item.sku || item.product_slug} · {money(item.unit_price)} each</p></div><span className="font-mono">× {item.quantity}</span><strong className="font-mono text-brand-heading">{money(item.line_total)}</strong></div>)}
              </Section>
              <div className="grid gap-5 md:grid-cols-2">
                <Section title="Customer"><Info label="Name" value={order.full_name}/><Info label="Email" value={order.email}/><Info label="Phone" value={order.phone}/><Info label="Institution" value={order.institution}/></Section>
                <Section title="Shipping address">{address ? Object.entries(address).filter(([, value]) => value).map(([key, value]) => <Info key={key} label={key.replace(/_/g, ' ')} value={String(value)}/>) : <p className="text-brand-textMuted">No address recorded.</p>}</Section>
              </div>
              <Section title="Internal notes"><textarea disabled={!canEdit} className="field-input min-h-28 resize-y" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes visible only to the team" /></Section>
              <Section title="Activity timeline">
                {(detail.activity ?? []).length === 0 ? <p className="text-brand-textMuted">No activity recorded.</p> : (detail.activity ?? []).map((entry) => <div key={entry.id} className="border-t border-brand-border py-3 first:border-t-0"><div className="flex justify-between gap-3"><strong className="capitalize text-brand-heading">{entry.activity?.replace(/_/g, ' ')}</strong><span className="font-mono text-[0.6875rem] text-brand-textMuted">{new Date(entry.created_at).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-brand-body">{entry.body || '—'}</p>{entry.actor && <p className="mt-1 text-[0.6875rem] text-brand-textMuted">By {entry.actor}</p>}</div>)}
              </Section>
            </div>

            <aside className="space-y-5">
              <Section title="Workflow">
                <Field label="Order status"><select disabled={!canEdit} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} className="field-input capitalize">{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></Field>
                <Field label="Tracking number"><input disabled={!canEdit} className="field-input font-mono" value={draft.tracking_number} onChange={(e) => setDraft((d) => ({ ...d, tracking_number: e.target.value }))} placeholder="Carrier tracking number" /></Field>
                {ownership?.canAssign ? <Field label="Sales agent"><select value={draft.owner_id} onChange={(e) => setDraft((d) => ({ ...d, owner_id: e.target.value }))} className="field-input"><option value="">Unassigned</option>{ownership.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}{owner && !ownership.people.some((person) => person.id === owner) && <option value={owner}>Former agent</option>}</select></Field> : <Info label="Sales agent" value={!owner ? 'Unassigned' : owner === ownership?.you ? 'You' : 'Assigned'} />}
                <Info label="Agent source" value={order.agent_source}/><Info label="Referral code" value={order.referral_code}/>
              </Section>
              <Section title="Payment"><Info label="Method" value={order.payment_provider}/><Field label="Payment reference"><input disabled={!canEdit} className="field-input" value={draft.payment_reference} onChange={(e) => setDraft((d) => ({ ...d, payment_reference: e.target.value }))} /></Field><Info label="Currency" value={order.currency}/><Info label="Compliance acknowledged" value={order.compliance_ack ? 'Yes' : 'No'}/></Section>
              <Section title="Fulfilment"><Info label="Stage" value={detail.fulfillment?.stage}/><Info label="Assigned to" value={detail.fulfillment?.assigned_to}/><Info label="Picked" value={detail.fulfillment?.picked_at ? new Date(detail.fulfillment.picked_at).toLocaleString() : null}/><Info label="Packed" value={detail.fulfillment?.packed_at ? new Date(detail.fulfillment.packed_at).toLocaleString() : null}/><Info label="Dispatched" value={detail.fulfillment?.dispatched_at ? new Date(detail.fulfillment.dispatched_at).toLocaleString() : null}/><Info label="Notes" value={detail.fulfillment?.notes}/></Section>
              <Section title="Totals">{[['Subtotal', order.subtotal], ['Discount', order.discount_total], ['Shipping', order.shipping_total], ['Grand total', order.grand_total]].map(([label, value]) => <div key={String(label)} className="flex justify-between border-t border-brand-border py-2 first:border-t-0"><span>{label}</span><strong className="font-mono text-brand-heading">{money(value)}</strong></div>)}</Section>
            </aside>
          </div>
        )}
      </div>

      {confirming && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="alertdialog" aria-modal="true" aria-label="Confirm order changes"><div className="w-full max-w-md border border-brand-border bg-brand-card p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-action"/><div><h3 className="font-display text-sm font-black uppercase text-brand-heading">Confirm sensitive changes</h3><p className="mt-2 text-xs leading-relaxed text-brand-body">This can change fulfilment, customer communication and commission. Confirm that you reviewed the status, tracking number, payment reference, notes and sales agent.</p></div></div><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>Go back</button><button className="btn-primary px-4 py-2" disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin"/>} Confirm and save</button></div></div></div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-brand-border bg-brand-dark p-4 text-xs"><h3 className="mb-3 font-display text-xs font-black uppercase tracking-[0.1em] text-brand-heading">{title}</h3>{children}</section>; }
function Info({ label, value }: { label: string; value: unknown }) { return <div className="flex justify-between gap-4 border-t border-brand-border py-2 first:border-t-0"><span className="capitalize text-brand-textMuted">{label}</span><span className="max-w-[65%] break-words text-right text-brand-heading">{value == null || value === '' ? '—' : String(value)}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mb-3 block last:mb-0"><span className="eyebrow mb-1.5 block">{label}</span>{children}</label>; }
