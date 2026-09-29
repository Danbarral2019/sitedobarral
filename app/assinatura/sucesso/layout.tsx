import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: 'Confirmação da Assinatura',
  robots: NOINDEX,
};

export default function AssinaturaSucessoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
