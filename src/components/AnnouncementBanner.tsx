'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { activeBanners, normalizeBanners, type Banner } from '@/lib/banner';

/**
 * The strip above the header. Whatever staff type into Dashboard > Storefront
 * appears here within a page load - this is the link between the dashboard and
 * the public site.
 *
 * Renders nothing at all when no banner is switched on, so the header sits
 * flush against the top of the page as it did before.
 */

/** Enough copies of the track that the marquee never shows a gap. */
const REPEATS = 3;

export default function AnnouncementBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let live = true;

    supabase
      .from('site_settings')
      .select('value')
      .eq('id', 'announcement_banners')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live || error) return;
        setBanners(activeBanners(normalizeBanners(data?.value)));
      });

    return () => { live = false; };
  }, []);

  if (banners.length === 0) return null;

  const line = banners.map((b) => b.text).join('   •   ');
  // Long copy needs proportionally longer to cross, or it reads as a blur.
  const seconds = Math.max(18, Math.round(line.length * 0.42));
  const href = banners.find((b) => b.href)?.href;

  const track = (
    <div className="announce-track" style={{ animationDuration: `${seconds}s` }}>
      {Array.from({ length: REPEATS }).map((_, i) => (
        <span key={i} className="announce-item">{line}</span>
      ))}
    </div>
  );

  return (
    <div className="border-b border-black/25 bg-flag-red">
      {href ? (
        <Link href={href} className="announce block">{track}</Link>
      ) : (
        <div className="announce">{track}</div>
      )}
    </div>
  );
}
