import { Metadata } from 'next';
import LeiComentadaClient from './LeiComentadaClient';

export const metadata: Metadata = {
  title: 'Lei 14.133/2021 Comentada — Prof. Daniel Barral',
  description:
    'Lei nº 14.133, de 1º de abril de 2021. Nova Lei de Licitações e Contratos Administrativos — texto integral dos artigos com regulamentações em destaque, jurisprudência, pareceres e enunciados interpretativos relacionados.',
  alternates: { canonical: '/lei-14133' },
};

export default function LeiPage() {
  return <LeiComentadaClient />;
}
