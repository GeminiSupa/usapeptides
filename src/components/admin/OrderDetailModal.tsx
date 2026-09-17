'use client';

import React from 'react';
import { X } from 'lucide-react';

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;
const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function OrderDetailModal({ row, detail, error, onClose, onPatch }: {
  row: Record<string, any>;
  detail?: { order?: Record<string, any>; items?: Record<string, any>[]; fulfillment?: Record<string, any> | null; activity?: Record<string, any>[] };
  error?: string;
  onClose: () => void;
  onPatch: (id: string, changes: Record<string, unknown>) => Promise<void> | void;
}) {
  const order = detail?.order ?? row;
  const items = detail?.items ?? [];
  const address = order.shipping_address && typeof order.shipping_address === 'object' ? order.shipping_address : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Order details">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto border border-brand-border bg-brand-card [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-brand-border bg-brand-card px-5 py-4">
          <div>
            <div className="eyebrow">Order</div>
            <h2 className="mt-1 font-display text-lg font-black text-brand-heading">{order.order_number}</h2>
            <p className="mt-1 text-xs text-brand-textMuted">Placed {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</p>
          </div>
          <button onClick={onClose} aria-label="Close order details" className="p-2 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
        </header>

        {error ? <p className="m-5 border border-brand-accent/50 p-4 text-xs">{error}</p> : !detail ? (
          <p className="p-8 text-center text-xs text-brand-textMuted">Loading complete order details...</p>
        ) : (
          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              <Section title="Items">
                {items.length === 0 ? <p className="text-brand-textMuted">No line items found.</p> : items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-brand-border py-3 text-xs first:border-t-0">
                    <div><strong className="text-brand-heading">{item.product_name}</strong><p className="mt-1 font-mono text-brand-textMuted">{item.sku || item.product_slug} · {money(item.unit_price)} each</p></div>
                    <span className="font-mono">× {item.quantity}</span><strong className="font-mono text-brand-heading">{money(item.line_total)}</strong>
                  </div>
                ))}
              </Section>

              <div className="grid gap-5 md:grid-cols-2">
                <Section title="Customer"><Info label="Name" value={order.full_name}/><Info label="Email" value={order.email}/><Info label="Phone" value={order.phone}/><Info label="Institution" value={order.institution}/></Section>
                <Section title="Shipping address">{address ? Object.entries(address).filter(([,v]) => v).map(([k,v]) => <Info key={k} label={k.replace(/_/g,' ')} value={String(v)}/>) : <p className="text-brand-textMuted">No address recorded.</p>}</Section>
              </div>

              <Section title="Internal notes"><p className="whitespace-pre-wrap leading-relaxed text-brand-body">{order.notes || 'No notes.'}</p></Section>
              <Section title="Activity timeline">
                {(detail.activity ?? []).length === 0 ? <p className="text-brand-textMuted">No activity recorded.</p> : (detail.activity ?? []).map((entry) => (
                  <div key={entry.id} className="border-t border-brand-border py-3 first:border-t-0">
                    <div className="flex justify-between gap-3"><strong className="capitalize text-brand-heading">{entry.activity?.replace(/_/g, ' ')}</strong><span className="font-mono text-[0.6875rem] text-brand-textMuted">{new Date(entry.created_at).toLocaleString()}</span></div>
                    <p className="mt-1 whitespace-pre-wrap text-brand-body">{entry.body || '—'}</p>{entry.actor && <p className="mt-1 text-[0.6875rem] text-brand-textMuted">By {entry.actor}</p>}
                  </div>
                ))}
              </Section>
            </div>

            <aside className="space-y-5">
              <Section title="Workflow">
                <label className="block"><span className="eyebrow mb-1.5 block">Order status</span><select value={order.status ?? 'pending'} onChange={(e) => void onPatch(order.id, { status: e.target.value })} className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs capitalize text-brand-heading">{statuses.map((s)=><option key={s} value={s}>{s}</option>)}</select></label>
                <Info label="Tracking" value={order.tracking_number}/><Info label="Agent source" value={order.agent_source}/><Info label="Referral code" value={order.referral_code}/>
              </Section>
              <Section title="Payment"><Info label="Method" value={order.payment_provider}/><Info label="Reference" value={order.payment_reference}/><Info label="Currency" value={order.currency}/><Info label="Compliance acknowledged" value={order.compliance_ack ? 'Yes' : 'No'}/></Section>
              <Section title="Fulfilment">
                <Info label="Stage" value={detail.fulfillment?.stage}/><Info label="Assigned to" value={detail.fulfillment?.assigned_to}/><Info label="Picked" value={detail.fulfillment?.picked_at ? new Date(detail.fulfillment.picked_at).toLocaleString() : null}/><Info label="Packed" value={detail.fulfillment?.packed_at ? new Date(detail.fulfillment.packed_at).toLocaleString() : null}/><Info label="Dispatched" value={detail.fulfillment?.dispatched_at ? new Date(detail.fulfillment.dispatched_at).toLocaleString() : null}/><Info label="Notes" value={detail.fulfillment?.notes}/>
              </Section>
              <Section title="Totals">{[['Subtotal',order.subtotal],['Discount',order.discount_total],['Shipping',order.shipping_total],['Grand total',order.grand_total]].map(([l,v])=><div key={String(l)} className="flex justify-between border-t border-brand-border py-2 first:border-t-0"><span>{l}</span><strong className="font-mono text-brand-heading">{money(v)}</strong></div>)}</Section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }:{title:string;children:React.ReactNode}){return <section className="border border-brand-border bg-brand-dark p-4 text-xs"><h3 className="mb-3 font-display text-xs font-black uppercase tracking-[0.1em] text-brand-heading">{title}</h3>{children}</section>}
function Info({label,value}:{label:string;value:unknown}){return <div className="flex justify-between gap-4 border-t border-brand-border py-2 first:border-t-0"><span className="capitalize text-brand-textMuted">{label}</span><span className="max-w-[65%] break-words text-right text-brand-heading">{value == null || value === '' ? '—' : String(value)}</span></div>}
