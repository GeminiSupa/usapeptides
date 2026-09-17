import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import StorefrontShell from '@/components/StorefrontShell';
import { SiteContentProvider } from '@/components/SiteContentProvider';
import { getSiteContent } from '@/lib/siteContentServer';
import { jsonLd, organizationSchema, siteUrl } from '@/lib/seo';

/**
 * Root layout. Runs on the server so the title, description, share image and
 * structured data come from Dashboard > Storefront > SEO and are in the HTML
 * that search engines and answer engines read. Everything that needs the
 * browser lives in StorefrontShell.
 */

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent();
  const image = c['seo.ogImage'] || undefined;
  const verification: Metadata['verification'] = {};
  if (c['seo.googleVerification']) verification.google = c['seo.googleVerification'];
  if (c['seo.bingVerification']) verification.other = { 'msvalidate.01': c['seo.bingVerification'] };

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: c['seo.siteTitle'], template: `%s${c['seo.titleSuffix']}` },
    description: c['seo.description'],
    keywords: c['seo.keywords'].split(',').map((k) => k.trim()).filter(Boolean),
    applicationName: c['business.name'],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: c['business.name'],
      title: c['seo.siteTitle'],
      description: c['seo.description'],
      url: '/',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      site: c['seo.twitterHandle'] || undefined,
      title: c['seo.siteTitle'],
      description: c['seo.description'],
      images: image ? [image] : undefined,
    },
    verification,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getSiteContent();

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="/fonts/cera.css" />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationSchema(content))} />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-dark text-brand-body pb-16 lg:pb-0">
        <SiteContentProvider value={content}>
          <StorefrontShell>{children}</StorefrontShell>
        </SiteContentProvider>
      </body>
    </html>
  );
}
