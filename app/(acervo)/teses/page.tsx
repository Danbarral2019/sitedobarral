import { Metadata } from 'next';
import TesesClient from './TesesClient';
import { listarVitrine } from '@/lib/teses/consultas';
import { getSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Teses do TCU em Licitações e Contratos',
  description: 'Enunciados extraídos de como os votos do próprio TCU invocam cada precedente, com os trechos que os sustentam à vista.',
  openGraph: {
    title: 'Teses do TCU em Licitações e Contratos',
    description: 'Enunciados extraídos de como os votos do próprio TCU invocam cada precedente, com os trechos que os sustentam à vista.',
    url: new URL('/teses', getSiteUrl()),
    siteName: 'Prof. Daniel Barral - Direito Administrativo',
    locale: 'pt_BR',
    type: 'website',
  },
  alternates: {
    canonical: new URL('/teses', getSiteUrl()),
  },
};

export const revalidate = 1800;

export default async function TesesPage() {
  const teses = await listarVitrine();
  return <TesesClient teses={teses} />;
}
