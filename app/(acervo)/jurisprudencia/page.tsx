import { Metadata } from 'next';
import JurisprudenciaClient from './JurisprudenciaClient';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Jurisprudência sobre Licitações e Contratos',
  description: 'Decisões de Tribunais de Contas Estaduais e do Poder Judiciário sobre licitações e contratos administrativos na Lei 14.133/2021.',
  openGraph: {
    title: 'Jurisprudência sobre Licitações e Contratos',
    description: 'Decisões de Tribunais de Contas Estaduais e do Poder Judiciário sobre licitações e contratos administrativos.',
    url: new URL('/jurisprudencia', getSiteUrl()),
    siteName: 'Prof. Daniel Barral - Direito Administrativo',
    locale: 'pt_BR',
    type: 'website',
  },
  alternates: {
    canonical: new URL('/jurisprudencia', getSiteUrl()),
  },
};

export const revalidate = 1800;

export default function JurisprudenciaPage() {
  return <JurisprudenciaClient />;
}
