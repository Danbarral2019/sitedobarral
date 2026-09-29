import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Redefinir Senha',
};

export default function RedefinirSenhaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
