import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Redefinir Senha',
  robots: NOINDEX,
};

export default function RedefinirSenhaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
