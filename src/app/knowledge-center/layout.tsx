import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('knowledge', '/knowledge-center');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
