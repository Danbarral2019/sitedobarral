import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirmação da Assinatura',
};

export default function AssinaturaSucessoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
