import type { Metadata } from 'next';
import InstallApp from '@/components/InstallApp';

export const metadata: Metadata = {
  title: 'Install app',
  description: 'Add the shop to your Android or iPhone home screen.',
  alternates: { canonical: '/install' },
};

export default function InstallPage() { return <InstallApp />; }
