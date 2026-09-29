import type { Metadata } from 'next';
import { NOINDEX, TITLE_TEMPLATE } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Criar Conta', template: TITLE_TEMPLATE },
  robots: NOINDEX,
};

export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
