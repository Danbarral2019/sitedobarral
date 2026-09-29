import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: 'Lei 14.133/2021 (prévia)',
  // Protótipo da página da lei: o conteúdo indexável é /lei-14133.
  robots: NOINDEX,
};

export default function Lei14133PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
