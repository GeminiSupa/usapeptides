import type { Metadata } from 'next';

/** Personal pages: no value in search results. */
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
