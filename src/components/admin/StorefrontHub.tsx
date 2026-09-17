'use client';

import React, { useState } from 'react';
import { FileText, Megaphone, Type } from 'lucide-react';
import StorefrontPanel from './StorefrontPanel';
import SiteContentEditor from './SiteContentEditor';
import BlogManager from './BlogManager';
import type { UploadKind } from './UploadField';

/**
 * Storefront: the whole public website from one place — its words, contact
 * details, FAQ and SEO; the blog; and the announcement bar and WhatsApp button.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
type Tab = 'content' | 'blog' | 'bar';

const TABS: { id: Tab; label: string; icon: typeof Type }[] = [
  { id: 'content', label: 'Website text & SEO', icon: Type },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'bar', label: 'Announcement & WhatsApp', icon: Megaphone },
];

export default function StorefrontHub({ authedFetch, upload, initialTab = 'content' }: {
  authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-brand-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] ${
              tab === id ? 'border-brand-accent text-brand-heading' : 'border-transparent text-brand-textMuted hover:text-brand-body'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {tab === 'content' && <SiteContentEditor authedFetch={authedFetch} upload={upload} />}
      {tab === 'blog' && <BlogManager authedFetch={authedFetch} upload={upload} />}
      {tab === 'bar' && <StorefrontPanel authedFetch={authedFetch} />}
    </div>
  );
}
