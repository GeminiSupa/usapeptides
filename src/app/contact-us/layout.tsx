import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('contact', '/contact-us');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
