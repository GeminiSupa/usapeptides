import type { MetadataRoute } from 'next';
import { getSiteContent } from '@/lib/siteContentServer';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const content = await getSiteContent();
  return {
    id: '/',
    name: content['business.name'],
    short_name: content['business.name'],
    description: 'Browse research products, view certificates and manage your orders.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FDFBF0',
    theme_color: '#1F4233',
    lang: 'en',
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
