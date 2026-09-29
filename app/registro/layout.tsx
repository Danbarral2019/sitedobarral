import type { Metadata } from 'next';
import { TITLE_TEMPLATE } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Criar Conta', template: TITLE_TEMPLATE },
};

export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
