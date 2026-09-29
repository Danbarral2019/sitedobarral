import type { Metadata } from 'next';
import { TITLE_TEMPLATE } from '@/lib/site-metadata';

export const metadata: Metadata = {
  title: { default: 'Glossário de Licitações', template: TITLE_TEMPLATE },
  description: 'Termos técnicos de licitações e contratos administrativos explicados de forma clara e objetiva.',
  alternates: {
    canonical: '/glossario',
  },
};

export default function GlossarioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
