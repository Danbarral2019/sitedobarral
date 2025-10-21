import type { Metadata } from 'next';

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
    title: 'Contato | Prof. Daniel Barral',
    description: 'Entre em contato com o Prof. Daniel Barral. Solicite informações sobre cursos ou envie seu depoimento.',
    url: 'https://profdanielbarral.com/contato',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary',
    title: 'Contato | Prof. Daniel Barral',
    description: 'Entre em contato com o Prof. Daniel Barral',
  },
  alternates: {
    canonical: '/contato',
  },
};

export default function ContatoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
