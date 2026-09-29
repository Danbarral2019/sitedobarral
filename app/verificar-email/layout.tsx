import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificação de E-mail',
};

export default function VerificarEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
