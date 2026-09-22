'use client';

import { useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

/** Touch and keyboard inspection of the actual product photographs. */
export default function ProductImageViewer({ name, image, detailImage }: {
  name: string; image: string; detailImage?: string;
}) {
  const images = Array.from(new Set([detailImage, image].filter(Boolean))) as string[];
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const src = images[selected] || images[0];
  if (!src) return <p className="text-sm text-brand-textMuted">Product photo coming soon</p>;

  return (
    <div className="w-full pt-10">
      <button type="button" aria-label={`${zoomed ? 'Zoom out' : 'Zoom in'}: ${name}`}
        aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}
        className="group relative block aspect-square w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
        <div key={src} className="product-photo-reveal h-full w-full">
          <img src={src} alt={name} draggable={false}
            className={`h-full w-full object-contain transition-transform duration-500 ease-out motion-reduce:transition-none ${zoomed ? 'scale-[1.65]' : 'scale-100 sm:group-hover:scale-[1.04]'}`} />
        </div>
        <span className="absolute bottom-2 right-2 flex min-h-11 items-center gap-2 border border-brand-border bg-brand-card px-3 text-xs text-brand-heading">
          {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          {zoomed ? 'Zoom out' : 'Tap to zoom'}
        </span>
      </button>
      {images.length > 1 && <div className="mt-3 flex justify-center gap-3" aria-label="Product photo views">
        {images.map((url, index) => <button key={url} type="button"
          aria-label={`Show ${index === 0 ? 'detail' : 'alternate'} photo`} aria-pressed={index === selected}
          onClick={() => { setSelected(index); setZoomed(false); }}
          className={`h-16 w-16 border-2 p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent ${index === selected ? 'border-brand-accent' : 'border-brand-border'}`}>
          <img src={url} alt="" className="h-full w-full object-contain" />
        </button>)}
      </div>}
    </div>
  );
}
