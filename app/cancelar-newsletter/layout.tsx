import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cancelar Inscrição na Newsletter',
};

export default function CancelarNewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
