import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conta Criada',
};

export default function RegistroConfirmacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
