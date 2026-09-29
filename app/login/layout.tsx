import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Área do Aluno',
  robots: NOINDEX,
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
