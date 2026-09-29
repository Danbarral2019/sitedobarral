import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: 'Esqueci Minha Senha',
  robots: NOINDEX,
};

export default function EsqueciSenhaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
