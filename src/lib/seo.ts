import 'server-only';

import type { Metadata } from 'next';
import { BUSINESS } from './env';
import { contentLines, parseFaqs, type SiteContent } from './siteContent';
import { getSiteContent } from './siteContentServer';

/**
 * Metadata and structured data built from the dashboard's SEO settings.
 */

export const siteUrl = () => BUSINESS.domain.replace(/\/+$/, '');

const keywords = (value: string) => value.split(',').map((k) => k.trim()).filter(Boolean);

/** Metadata for one of the fixed pages, e.g. pageMetadata('shop', '/shop'). */
export async function pageMetadata(page: string, path: string, extra: Partial<Metadata> = {}): Promise<Metadata> {
  const c = await getSiteContent();
  const title = c[`seo.${page}.title`] || undefined;
  const description = c[`seo.${page}.description`] || c['seo.description'];
  return {
    // A plain string here would stop the brand suffix reaching pages below
    // this one (a blog post under /blog), so the template is repeated.
    title: title
      ? { default: title, template: `%s${c['seo.titleSuffix']}` }
      : { default: c['seo.siteTitle'], template: `%s${c['seo.titleSuffix']}` },
    description,
    alternates: { canonical: path },
    openGraph: { title: title ? `${title}${c['seo.titleSuffix']}` : c['seo.siteTitle'], description, url: path },
    ...extra,
  };
}

/** JSON-LD must not be able to close its own script tag. */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

export function organizationSchema(c: SiteContent) {
  const url = siteUrl();
  const sameAs = ['social.instagram', 'social.facebook', 'social.x', 'social.youtube', 'social.tiktok', 'social.linkedin']
    .map((k) => c[k]).filter((v) => /^https:\/\//i.test(v ?? ''));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: c['business.name'],
        url,
        logo: `${url}/logo.png`,
        description: c['aeo.summary'],
        email: c['contact.email'] || undefined,
        telephone: c['contact.phone'] || undefined,
        address: c['contact.address'] ? { '@type': 'PostalAddress', streetAddress: c['contact.address'], addressCountry: BUSINESS.country } : undefined,
        sameAs: sameAs.length ? sameAs : undefined,
        audience: c['aeo.audience'] ? { '@type': 'Audience', audienceType: c['aeo.audience'] } : undefined,
        contactPoint: c['contact.email'] || c['contact.phone'] ? {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: c['contact.email'] || undefined,
          telephone: c['contact.phone'] || undefined,
          hoursAvailable: c['contact.hours'] || undefined,
        } : undefined,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        url,
        name: c['business.name'],
        description: c['seo.description'],
        publisher: { '@id': `${url}/#organization` },
      },
    ],
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export async function siteFaqs() {
  return parseFaqs((await getSiteContent())['faq.items']);
}

export { contentLines };
