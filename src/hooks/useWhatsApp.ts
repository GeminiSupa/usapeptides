'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EMPTY_WHATSAPP, WHATSAPP_SETTING_ID, normalizeWhatsApp, type WhatsAppSettings } from '@/lib/whatsapp';

/** One read per page load, shared by every button on the page. */
let pending: Promise<WhatsAppSettings> | null = null;

function loadWhatsApp(): Promise<WhatsAppSettings> {
  if (!supabase) return Promise.resolve(EMPTY_WHATSAPP);
  pending ??= Promise.resolve(
    supabase
      .from('site_settings')
      .select('value')
      .eq('id', WHATSAPP_SETTING_ID)
      .maybeSingle()
  )
    .then(({ data, error }) => (error ? EMPTY_WHATSAPP : normalizeWhatsApp(data?.value)))
    .catch(() => EMPTY_WHATSAPP);
  return pending;
}

/** The WhatsApp number to order on, or null when the button should not show. */
export function useWhatsApp(): string | null {
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadWhatsApp().then((s) => { if (live) setNumber(s.enabled ? s.number : null); });
    return () => { live = false; };
  }, []);
  return number;
}
