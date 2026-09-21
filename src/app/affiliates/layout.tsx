import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('affiliates', '/affiliates');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
