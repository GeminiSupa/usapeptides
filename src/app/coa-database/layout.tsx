import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('coa', '/coa-database');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
