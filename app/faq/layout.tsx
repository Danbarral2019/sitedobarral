import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Perguntas Frequentes',
  description: 'Encontre respostas rápidas para as dúvidas mais comuns sobre licitações, documentos e acesso ao site do Prof. Daniel Barral.',
  alternates: {
    canonical: '/faq',
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
