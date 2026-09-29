import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: 'Cancelar Inscrição na Newsletter',
  robots: NOINDEX,
};

export default function CancelarNewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
