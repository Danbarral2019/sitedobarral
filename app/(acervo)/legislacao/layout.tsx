import type { Metadata } from 'next';
import { TITLE_TEMPLATE } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: { default: 'Legislação de Licitações e Contratos', template: TITLE_TEMPLATE },
  description: 'Leis, decretos, instruções normativas e portarias sobre licitações e contratos administrativos, com texto integral e relações entre os atos.',
};

export default function LegislacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
