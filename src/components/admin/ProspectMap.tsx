'use client';

/* eslint-disable @next/next/no-img-element -- map tiles are third-party images addressed by z/x/y */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Loader2, Minus, Plus, Search } from 'lucide-react';
import { mapsEnv } from '@/lib/env';
import { MAX_BBOX_DEGREES } from '@/lib/prospector';
import { bounds, fit, pan, project, tiles, zoomAt, type LatLng, type MapView } from '@/lib/mapMath';

/**
 * The Prospector map: OpenStreetMap tiles with one pin per business. Drag to
 * move, scroll or use the buttons to zoom, click a pin to select it, and
 * "Search this area" looks for businesses inside what is on screen.
 */

export interface MapPin extends LatLng { key: string; label: string; tone: 'high' | 'medium' | 'low' | 'saved' }

interface Props {
  pins: MapPin[];
  selected: string | null;
  onSelect: (key: string) => void;
  onSearchArea?: (box: { south: number; west: number; north: number; east: number }) => void;
  searching?: boolean;
  /** Centre to jump to when a search names a place but finds nothing. */
  focus?: LatLng | null;
}

const START: MapView = { latitude: 39.5, longitude: -98.35, zoom: 4, width: 640, height: 480 }; // the continental US
const TONE: Record<MapPin['tone'], string> = {
  high: 'bg-forest border-white',
  medium: 'bg-navy border-white',
  low: 'bg-white border-forest',
  saved: 'bg-action border-white',
};

export default function ProspectMap({ pins, selected, onSelect, onSearchArea, searching, focus }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [view, setView] = useState<MapView>(START);
  const [moved, setMoved] = useState(false);
  const fitted = useRef('');

  // Keep the view the size of the panel.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setView((v) => ({ ...v, width: Math.round(width), height: Math.round(height) }));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fit to a new set of results — not on every render, or it would fight the user.
  const signature = useMemo(() => pins.map((p) => p.key).sort().join('|'), [pins]);
  useEffect(() => {
    if (!pins.length || signature === fitted.current || view.width < 50) return;
    fitted.current = signature;
    setView((v) => fit(pins, v));
    setMoved(false);
  }, [signature, pins, view.width]);

  useEffect(() => {
    if (focus && !pins.length) setView((v) => ({ ...v, latitude: focus.latitude, longitude: focus.longitude, zoom: 11 }));
  }, [focus, pins.length]);

  // Centre on a pin picked from the list if it is off screen.
  useEffect(() => {
    const pin = pins.find((p) => p.key === selected);
    if (!pin) return;
    setView((v) => {
      const pt = project(pin, v);
      return pt.x < 20 || pt.y < 20 || pt.x > v.width - 20 || pt.y > v.height - 20
        ? { ...v, latitude: pin.latitude, longitude: pin.longitude, zoom: Math.max(v.zoom, 13) }
        : v;
    });
  }, [selected, pins]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = box.current!.getBoundingClientRect();
    setView((v) => zoomAt(v, e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top));
    setMoved(true);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const area = bounds(view);
  const areaSize = (area.north - area.south) * (area.east - area.west);
  const tooBig = areaSize > MAX_BBOX_DEGREES;

  return (
    <div className="relative h-full min-h-[22rem] overflow-hidden border border-brand-border bg-cream-200">
      <div
        ref={box}
        className={`absolute inset-0 touch-none select-none ${drag.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 4) return;
          d.moved = true;
          d.x = e.clientX; d.y = e.clientY;
          setView((v) => pan(v, dx, dy));
          setMoved(true);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={(e) => {
          const rect = box.current!.getBoundingClientRect();
          setView((v) => zoomAt(v, 1, e.clientX - rect.left, e.clientY - rect.top));
          setMoved(true);
        }}
      >
        {tiles(view, mapsEnv.tileUrl).map((t) => (
          <img key={t.key} src={t.src} alt="" draggable={false} loading="lazy"
            className="pointer-events-none absolute h-[256px] w-[256px] max-w-none" style={{ left: t.left, top: t.top }} />
        ))}

        {pins.map((pin) => {
          const pt = project(pin, view);
          if (pt.x < -20 || pt.y < -20 || pt.x > view.width + 20 || pt.y > view.height + 20) return null;
          const on = pin.key === selected;
          return (
            <button
              key={pin.key}
              type="button"
              title={pin.label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(pin.key)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform ${TONE[pin.tone]} ${
                on ? 'z-20 h-6 w-6 ring-4 ring-action' : 'z-10 h-[18px] w-[18px] hover:scale-125'}`}
              style={{ left: pt.x, top: pt.y }}
            />
          );
        })}
      </div>

      <div className="absolute right-2 top-2 flex flex-col border border-brand-border bg-brand-card">
        <button type="button" aria-label="Zoom in" className="p-2 hover:bg-brand-dark" onClick={() => { setView((v) => zoomAt(v, 1)); setMoved(true); }}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" className="border-t border-brand-border p-2 hover:bg-brand-dark" onClick={() => { setView((v) => zoomAt(v, -1)); setMoved(true); }}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Show all results" disabled={!pins.length} className="border-t border-brand-border p-2 hover:bg-brand-dark disabled:opacity-40"
          onClick={() => { setView((v) => fit(pins, v)); setMoved(false); }}><Crosshair className="h-4 w-4" /></button>
      </div>

      {onSearchArea && (moved || !pins.length) && (
        <button
          type="button"
          disabled={searching || tooBig}
          onClick={() => onSearchArea(area)}
          title={tooBig ? 'Zoom in to a city or metro area first' : undefined}
          className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 border border-brand-border bg-brand-card px-3 py-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading shadow-none hover:border-brand-accent disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {tooBig ? 'Zoom in to search here' : 'Search this area'}
        </button>
      )}

      <p className="absolute bottom-0 right-0 bg-brand-card/90 px-1.5 py-0.5 text-[0.625rem] text-brand-textMuted">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
      </p>
    </div>
  );
}
