import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Esqueci Minha Senha',
};

export default function EsqueciSenhaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
