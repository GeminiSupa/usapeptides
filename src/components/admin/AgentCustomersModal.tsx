'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, UserRound, X } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

export default function AgentCustomersModal({ agentId, authedFetch, onClose }: { agentId: string; authedFetch: Fetcher; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authedFetch(`/api/admin/customers/by-agent?agentId=${encodeURIComponent(agentId)}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? 'Could not load this agent’s customers.');
      setData(payload.data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load this agent’s customers.'); }
    finally { setLoading(false); }
  }, [agentId, authedFetch]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Sales agent customers">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto border border-brand-border bg-brand-card">
        <header className="sticky top-0 flex items-center justify-between border-b border-brand-border bg-brand-card px-5 py-4"><div><p className="eyebrow">Sales agent profile</p><h2 className="mt-1 font-display text-lg font-black text-brand-heading">{data?.agent?.full_name || data?.agent?.email || 'Customers'}</h2></div><button onClick={onClose} className="p-2 text-brand-textMuted hover:text-brand-heading" aria-label="Close"><X className="h-5 w-5"/></button></header>
        <div className="p-5">
          {loading ? <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-4 w-4 animate-spin"/> Loading customers…</p> : error ? <p className="border border-action/50 p-3 text-xs text-brand-body">{error}</p> : !data?.customers?.length ? <p className="border border-brand-border bg-brand-dark p-8 text-center text-xs text-brand-textMuted">This sales agent has no owned customers.</p> : <div className="space-y-2">{data.customers.map((customer: any) => <button key={customer.id} onClick={() => setCustomerId(customer.id)} className="flex w-full items-center gap-3 border border-brand-border bg-brand-dark p-3 text-left hover:border-brand-accent"><UserRound className="h-4 w-4 flex-none text-brand-heading"/><span className="min-w-0 flex-1"><strong className="block truncate text-brand-heading">{customer.full_name || customer.email}</strong><span className="block truncate text-[0.6875rem] text-brand-textMuted">{customer.email}{customer.institution ? ` · ${customer.institution}` : ''}</span></span><span className="text-[0.6875rem] text-brand-textMuted">Open profile</span></button>)}</div>}
        </div>
      </div>
      {customerId && <CustomerDetailModal customerId={customerId} authedFetch={authedFetch} isAgent={false} onClose={() => setCustomerId(null)} onChanged={() => void load()} />}
    </div>
  );
}
