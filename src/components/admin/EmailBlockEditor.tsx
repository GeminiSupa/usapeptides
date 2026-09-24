'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Monitor, Plus, Smartphone, X } from 'lucide-react';
import UploadField, { type UploadKind } from './UploadField';
import { useSiteContent } from '@/components/SiteContentProvider';
import { useCatalogue } from '@/hooks/useCatalogue';
import {
  BLOCK_LABELS, newBlock, personalize, renderEmailHtml,
  type Block, type BlockType, type EmailDesign,
} from '@/lib/emailDesign';

/**
 * The email designer: blocks on the left, live preview on the right.
 *
 * Shared by Campaigns and by Email automation, so an email written in one
 * place looks exactly like an email written in the other and there is one
 * place to fix when a mail client disagrees with the layout.
 */

export default function EmailBlockEditor({ design, subject, previewText, onChange, upload }: {
  design: EmailDesign;
  /** Shown in the preview only; the editor never changes it. */
  subject: string;
  previewText?: string | null;
  onChange: (design: EmailDesign) => void;
  upload: (file: File, kind: UploadKind) => Promise<string>;
}) {
  const { t } = useSiteContent();
  const { products } = useCatalogue();
  const [selected, setSelected] = useState<string | null>(design.blocks[0]?.id ?? null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const blocks = design.blocks;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const setBlocks = (next: Block[]) => onChange({ ...design, blocks: next });
  const patchBlock = (id: string, patch: Partial<Block>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = (type: BlockType) => {
    const b = newBlock(type);
    const at = selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setSelected(b.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  const html = useMemo(() => {
    const sample = { name: 'Alex Morgan', email: 'alex@example.edu' };
    const filled = { ...design, blocks: design.blocks.map((b) => ({ ...b, text: b.text !== undefined ? personalize(b.text, sample, t('business.name')) : undefined })) };
    return renderEmailHtml(filled, subject, {
      businessName: t('business.name'), siteUrl: origin, address: t('contact.address'),
      previewText: previewText ?? '', unsubscribeUrl: '#unsubscribe',
    });
  }, [design, subject, previewText, origin, t]);

  const sel = blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="border border-brand-border bg-brand-card p-3">
          <p className="field-label">Add a block</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
              <button key={type} type="button" onClick={() => add(type)} className="chip border border-brand-borderLight text-brand-heading hover:border-brand-accent">
                <Plus className="h-3 w-3" /> {BLOCK_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">Heading colour
              <input type="color" value={design.accent ?? '#1F4233'} onChange={(e) => onChange({ ...design, accent: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5">Background
              <input type="color" value={design.background ?? '#F3F1E6'} onChange={(e) => onChange({ ...design, background: e.target.value })} />
            </label>
          </div>
        </div>

        <ol className="divide-y divide-brand-border/60 border border-brand-border bg-brand-card">
          {blocks.map((b, i) => (
            <li key={b.id} className={`flex items-center gap-2 px-3 py-2 ${selected === b.id ? 'bg-brand-dark' : ''}`}>
              <button type="button" onClick={() => setSelected(b.id)} className="min-w-0 flex-1 text-left">
                <span className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">{BLOCK_LABELS[b.type]}</span>
                <span className="ml-2 truncate text-[0.75rem] text-brand-textMuted">
                  {b.text?.slice(0, 40) || b.label || (b.type === 'products' ? `${b.items?.length ?? 0} products` : b.src ? 'picture' : '')}
                </span>
              </button>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(b.id, -1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(b.id, 1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Remove" onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); if (selected === b.id) setSelected(null); }} className="p-1 text-brand-textMuted hover:text-action"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {!blocks.length && <li className="p-6 text-center text-xs text-brand-textMuted">Empty. Add a block above.</li>}
        </ol>

        {sel && (
          <div className="space-y-3 border border-brand-border bg-brand-card p-3">
            <p className="field-label">Edit {BLOCK_LABELS[sel.type].toLowerCase()}</p>
            {(sel.type === 'heading' || sel.type === 'text' || sel.type === 'quote') && (
              <>
                <textarea className="field-input" rows={sel.type === 'text' ? 7 : 2} value={sel.text ?? ''} onChange={(e) => patchBlock(sel.id, { text: e.target.value })} />
                <p className="text-[0.6875rem] text-brand-textMuted">**bold**, *italic*, [link text](https://…). Merge fields like {'{first_name}'} work here.</p>
              </>
            )}
            {sel.type === 'heading' && (
              <select className="field-input" value={sel.size} onChange={(e) => patchBlock(sel.id, { size: e.target.value as 'lg' | 'md' })}>
                <option value="lg">Large</option><option value="md">Medium</option>
              </select>
            )}
            {['heading', 'text', 'quote', 'button'].includes(sel.type) && (
              <div className="flex gap-1">
                {(['left', 'center'] as const).map((a) => (
                  <button key={a} type="button" onClick={() => patchBlock(sel.id, { align: a })}
                    className={`chip ${sel.align === a ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight'}`}>{a === 'left' ? 'Left' : 'Centre'}</button>
                ))}
              </div>
            )}
            {sel.type === 'image' && (
              <>
                <UploadField kind="blog" value={sel.src ?? ''} onChange={(url) => patchBlock(sel.id, { src: url })} upload={upload} />
                <input className="field-input" placeholder="Describe the picture" value={sel.alt ?? ''} onChange={(e) => patchBlock(sel.id, { alt: e.target.value })} />
                <input className="field-input" placeholder="Link when clicked (optional): /shop or https://…" value={sel.href ?? ''} onChange={(e) => patchBlock(sel.id, { href: e.target.value })} />
              </>
            )}
            {sel.type === 'button' && (
              <>
                <input className="field-input" placeholder="Button text" value={sel.label ?? ''} onChange={(e) => patchBlock(sel.id, { label: e.target.value })} />
                <input className="field-input" placeholder="/shop or https://…" value={sel.href ?? ''} onChange={(e) => patchBlock(sel.id, { href: e.target.value })} />
                <select className="field-input" value={sel.style} onChange={(e) => patchBlock(sel.id, { style: e.target.value as Block['style'] })}>
                  <option value="action">Orange (buy)</option><option value="brand">Brand colour</option><option value="outline">Outline</option>
                </select>
              </>
            )}
            {sel.type === 'spacer' && (
              <label className="block text-xs">Height: {sel.height}px
                <input type="range" min={8} max={96} value={sel.height ?? 24} onChange={(e) => patchBlock(sel.id, { height: Number(e.target.value) })} className="w-full" />
              </label>
            )}
            {sel.type === 'products' && (
              <div className="space-y-2">
                <select className="field-input" value="" onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (!p || (sel.items?.length ?? 0) >= 6) return;
                  patchBlock(sel.id, { items: [...(sel.items ?? []), { name: p.name, price: `$${(p.salePrice ?? p.price).toFixed(2)}`, image: p.image, href: `/product/${p.slug}` }] });
                }}>
                  <option value="">Add a product… (up to 6)</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {(sel.items ?? []).map((it, n) => (
                  <div key={`${it.href}${n}`} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <input className="field-input min-h-8 w-20 py-1" value={it.price} onChange={(e) => patchBlock(sel.id, { items: sel.items!.map((x, k) => (k === n ? { ...x, price: e.target.value } : x)) })} />
                    <button type="button" onClick={() => patchBlock(sel.id, { items: sel.items!.filter((_, k) => k !== n) })} className="p-1 text-brand-textMuted hover:text-action"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="field-label mb-0">Preview</span>
          <div className="flex border border-brand-borderLight">
            {([['desktop', Monitor], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
              <button key={d} type="button" onClick={() => setDevice(d)} aria-label={d}
                className={`p-2 ${device === d ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body'}`}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
        </div>
        <div className="flex justify-center border border-brand-border bg-brand-dark p-3">
          <iframe title="Email preview" sandbox="allow-same-origin" srcDoc={html}
            className="h-[70vh] border border-brand-border bg-white" style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: 680 }} />
        </div>
      </div>
    </div>
  );
}
