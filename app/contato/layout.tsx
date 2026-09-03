import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contato',
  description: 'Entre em contato com o Prof. Daniel Barral. Envie suas dúvidas, solicite informações sobre cursos ou compartilhe seu depoimento.',
  keywords: [
    'contato Daniel Barral',
    'informações cursos',
    'solicitar informações',
    'depoimento alunos',
    'contato professor',
  ],
  openGraph: {
    title: 'Contato',
    description: 'Entre em contato com o Prof. Daniel Barral. Solicite informações sobre cursos ou envie seu depoimento.',
    url: new URL('/contato', getSiteUrl()),
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary',
    title: 'Contato',
    description: 'Entre em contato com o Prof. Daniel Barral',
  },
  alternates: {
    canonical: new URL('/contato', getSiteUrl()),
  },
};

export default function ContatoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
