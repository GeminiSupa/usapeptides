'use client';

import React, { createContext, useContext } from 'react';
import { DEFAULT_CONTENT, type SiteContent } from '@/lib/siteContent';

/**
 * The website's editable text, fetched once on the server by the root layout
 * and handed to every client component, so the page never flashes the
 * template wording before the saved wording arrives.
 */

const Ctx = createContext<SiteContent>(DEFAULT_CONTENT);

export function SiteContentProvider({ value, children }: { value: SiteContent; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `t('hero.title')` — the saved value, or the template default. */
export function useSiteContent() {
  const content = useContext(Ctx);
  const t = (key: string) => content[key] ?? DEFAULT_CONTENT[key] ?? '';
  return { content, t };
}
