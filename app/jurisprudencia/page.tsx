import { Metadata } from 'next';
import JurisprudenciaClient from './JurisprudenciaClient';

export const metadata: Metadata = {
  title: 'Jurisprudencia sobre Licitacoes | Prof. Daniel Barral',
  description: 'Acordaos do TCU e decisoes de Tribunais de Contas Estaduais sobre licitacoes e contratos administrativos (Lei 14.133/2021).',
  openGraph: {
    title: 'Jurisprudencia sobre Licitacoes',
    description: 'Acordaos do TCU e decisoes de Tribunais de Contas Estaduais sobre licitacoes e contratos administrativos.',
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
