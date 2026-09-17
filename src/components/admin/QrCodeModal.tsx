'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Download, Printer, X } from 'lucide-react';
import { downloadBlob } from '@/lib/sheetFiles';

/**
 * A QR code for any link: a product page, a salesperson's referral link, a
 * customer's sign-in page. Generated in the browser, so no link is sent to a
 * third-party QR service.
 */

export interface QrTarget {
  title: string;
  subtitle?: string;
  url: string;
  /** File name without extension. */
  filename: string;
}

export async function qrDataUrl(url: string, size = 1024): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#1F4233', light: '#FFFFFF' },
  });
}

export async function qrSvg(url: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1F4233', light: '#FFFFFF' } });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function QrCodeModal({ target, onClose }: { target: QrTarget; onClose: () => void }) {
  const [src, setSrc] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    qrDataUrl(target.url).then((url) => { if (live) setSrc(url); }).catch(() => setSrc(''));
    return () => { live = false; };
  }, [target.url]);

  const downloadPng = async () => {
    const blob = await (await fetch(src)).blob();
    downloadBlob(blob, `${target.filename}.png`);
  };

  const downloadSvg = async () => {
    downloadBlob(new Blob([await qrSvg(target.url)], { type: 'image/svg+xml' }), `${target.filename}.svg`);
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<!doctype html><title>${escapeHtml(target.title)}</title>
      <body style="font-family:sans-serif;text-align:center;padding:24px">
      <h2 style="margin:0 0 4px">${escapeHtml(target.title)}</h2>
      ${target.subtitle ? `<p style="margin:0 0 12px;color:#555">${escapeHtml(target.subtitle)}</p>` : ''}
      <img src="${src}" style="width:320px;height:320px" />
      <p style="font-size:11px;word-break:break-all;color:#555">${escapeHtml(target.url)}</p>
      <script>window.onload=()=>{window.print();}</script></body>`);
    w.document.close();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(target.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`QR code for ${target.title}`}>
      <div className="w-full max-w-sm border border-brand-border bg-brand-card">
        <div className="flex items-start justify-between gap-3 border-b border-brand-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">{target.title}</p>
            {target.subtitle && <p className="mt-0.5 truncate text-[0.75rem] text-brand-textMuted">{target.subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-brand-textMuted hover:text-brand-heading"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 text-center">
          <div className="mx-auto aspect-square w-60 border border-brand-border bg-white p-2">
            {src ? <img src={src} alt={`QR code linking to ${target.url}`} className="h-full w-full" /> : <span className="text-xs text-brand-textMuted">Generating…</span>}
          </div>
          <p className="mt-3 break-all font-mono text-[0.6875rem] text-brand-textMuted">{target.url}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 border-t border-brand-border p-3">
          <button onClick={() => void downloadPng()} disabled={!src} className="btn-secondary"><Download className="h-3.5 w-3.5" /> PNG</button>
          <button onClick={() => void downloadSvg()} className="btn-secondary"><Download className="h-3.5 w-3.5" /> SVG</button>
          <button onClick={print} disabled={!src} className="btn-secondary"><Printer className="h-3.5 w-3.5" /> Print</button>
          <button onClick={() => void copy()} className="btn-secondary"><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>
  );
}
