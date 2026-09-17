import type { Metadata } from 'next';
import { faqSchema, jsonLd, pageMetadata, siteFaqs } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('faq', '/faq');

/** The FAQ list is also published as FAQPage structured data for answer engines. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const schema = faqSchema(await siteFaqs());
  return (
    <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />}
      {children}
    </>
  );
}
