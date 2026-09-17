'use client';

import React, { useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type CatalogueView = 'tile' | 'row';

const KEY = 'shop.view';

/** Tiles or list, remembered in this browser only. */
export function useCatalogueView(): [CatalogueView, (v: CatalogueView) => void] {
  const [view, setView] = useState<CatalogueView>('tile');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === 'tile' || saved === 'row') setView(saved);
    } catch { /* storage blocked: keep tiles */ }
  }, []);

  const change = (next: CatalogueView) => {
    setView(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };

  return [view, change];
}

export default function CatalogueViewToggle({ view, onChange }: { view: CatalogueView; onChange: (v: CatalogueView) => void }) {
  return (
    <div className="flex flex-shrink-0 border border-brand-border" role="group" aria-label="Layout">
      {([['tile', LayoutGrid, 'Grid view'], ['row', List, 'List view']] as const).map(([id, Icon, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={view === id}
          aria-label={label}
          title={label}
          className={`flex min-h-11 min-w-11 items-center justify-center transition-colors ${
            view === id ? 'bg-brand-accent text-brand-onAccent' : 'bg-brand-dark text-brand-textMuted hover:text-brand-heading'
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
