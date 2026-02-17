import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Busca Integrada | Prof. Daniel Barral',
  description:
    'Pesquise em artigos da Lei 14.133/2021, atos normativos, glossário, documentos, blog e perguntas frequentes sobre licitações e contratos administrativos.',
  openGraph: {
    title: 'Busca Integrada — Licitações e Contratos',
    description:
      'Encontre artigos da Lei 14.133, acórdãos do TCU, pareceres, orientações normativas e muito mais.',
    type: 'website',
  },
};

export default function BuscaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
