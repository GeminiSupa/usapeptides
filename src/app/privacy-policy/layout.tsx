import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('privacy', '/privacy-policy');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
