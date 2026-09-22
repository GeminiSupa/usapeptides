'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PwaContext = createContext<{
  installed: boolean;
  canInstall: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}>({ installed: false, canInstall: false, install: async () => 'unavailable' });

export const usePwa = () => useContext(PwaContext);

export default function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const updateDisplay = () => setInstalled(display.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    updateDisplay();
    display.addEventListener('change', updateDisplay);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => { /* Installation can still work without offline support. */ });
    }
    return () => {
      display.removeEventListener('change', updateDisplay);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  const install = async () => {
    if (!prompt) return 'unavailable' as const;
    setPrompt(null); // Browser prompts are single-use, even after dismissal.
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  };

  return <PwaContext.Provider value={{ installed, canInstall: Boolean(prompt) && !installed, install }}>
    {children}
  </PwaContext.Provider>;
}
