import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Glossário de Licitações',
  description: 'Termos técnicos de licitações e contratos administrativos explicados de forma clara e objetiva.',
  alternates: {
    canonical: '/glossario',
  },
};

export default function GlossarioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
