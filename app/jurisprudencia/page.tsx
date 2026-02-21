import { Metadata } from 'next';
import JurisprudenciaClient from './JurisprudenciaClient';

export const metadata: Metadata = {
  title: 'Jurisprudência sobre Licitações e Contratos | Prof. Daniel Barral',
  description: 'Decisões de Tribunais de Contas Estaduais e do Poder Judiciário sobre licitações e contratos administrativos na Lei 14.133/2021.',
  openGraph: {
    title: 'Jurisprudência sobre Licitações e Contratos',
    description: 'Decisões de Tribunais de Contas Estaduais e do Poder Judiciário sobre licitações e contratos administrativos.',
    url: 'https://profbarral.com.br/jurisprudencia',
    siteName: 'Prof. Daniel Barral - Direito Administrativo',
    locale: 'pt_BR',
    type: 'website',
  },
  alternates: {
    canonical: 'https://profbarral.com.br/jurisprudencia',
  },
};

export default function JurisprudenciaPage() {
  return <JurisprudenciaClient />;
}
