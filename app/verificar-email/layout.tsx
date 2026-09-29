import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificação de E-mail',
  robots: NOINDEX,
};

export default function VerificarEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
