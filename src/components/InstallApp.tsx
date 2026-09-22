'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Smartphone } from 'lucide-react';
import { usePwa } from './PwaProvider';
import { useSiteContent } from './SiteContentProvider';

export default function InstallApp() {
  const { t } = useSiteContent();
  const { installed, canInstall, install } = usePwa();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleInstall() {
    setBusy(true);
    try {
      const result = await install();
      setMessage(result === 'accepted' ? 'Installation requested. Follow your browser’s instructions to finish.' :
        result === 'dismissed' ? 'You can install later using your browser menu.' :
          'Use the browser instructions below to add the app.');
    } catch {
      setMessage('The install prompt could not open. Use the browser instructions below.');
    } finally { setBusy(false); }
  }

  return <div className="shell max-w-4xl py-12 sm:py-20">
    <Smartphone className="mb-5 h-9 w-9 text-brand-accent" aria-hidden="true" />
    <p className="eyebrow mb-3">Your store, one tap away</p>
    <h1 className="page-title">Add {t('business.name')} to your phone</h1>
    <p className="mt-5 max-w-2xl">Open the shop straight from your home screen. Browse products, view certificates and access your account in a dedicated app window.</p>
    <p className="mt-3 text-sm text-brand-textMuted">Free to add from your browser. An internet connection is needed to browse, sign in and order.</p>

    <div className="my-8" aria-live="polite">
      {installed ? <div className="surface p-5"><p>You’re using the app or have just installed it.</p><Link className="btn-primary mt-4" href="/shop">Browse the shop</Link></div> :
        canInstall ? <button className="btn-primary" onClick={handleInstall} disabled={busy}><Download className="h-4 w-4" aria-hidden="true" />{busy ? 'Opening…' : 'Install app'}</button> :
          <p className="border-l-2 border-brand-accent pl-4">Use the steps for your phone below. Installation options vary by browser.</p>}
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    </div>

    {!installed && <div className="grid gap-5 md:grid-cols-2">
      <section className="surface p-6" aria-labelledby="android-install">
        <h2 id="android-install" className="section-title">Android / Chrome</h2>
        <ol className="mt-5 list-decimal space-y-3 pl-5">
          <li>Open this website in Chrome.</li>
          <li>Open the browser menu (three dots).</li>
          <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</li>
        </ol>
      </section>
      <section className="surface p-6" aria-labelledby="iphone-install">
        <h2 id="iphone-install" className="section-title">iPhone / Safari</h2>
        <ol className="mt-5 list-decimal space-y-3 pl-5">
          <li>Open this website in Safari.</li>
          <li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. You may need to scroll through the options.</li>
          <li>If shown, turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</li>
        </ol>
      </section>
    </div>}
    <p className="mt-6 text-sm text-brand-textMuted">Opened from a social or email app? Open this page in Safari or Chrome first. After installing, tap the new home-screen icon. You may need to sign in again.</p>
  </div>;
}
