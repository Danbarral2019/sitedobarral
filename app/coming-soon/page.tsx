import type { Metadata } from 'next';
import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';

export const metadata: Metadata = {
  title: 'Em breve',
  description: 'Novidades chegando em breve. Cadastre seu email para ser avisado.',
  // Decisão consciente: NÃO setar noindex. Coming-soon é servida com HTTP 200
  // na URL real (rewrite), Google continua indexando a URL como sempre.
  // Ver spec: docs/superpowers/specs/2026-05-14-coming-soon-prelaunch-design.md
};

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface-raised">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-ink-primary mb-4">
          Em breve
        </h1>
        <p className="text-lg text-ink-muted mb-8">
          {/* Microcopy placeholder — Daniel revisa antes do deploy */}
          Algo novo está chegando para quem trabalha com licitações e contratos.
          Cadastre seu email para ser avisado primeiro.
        </p>
        <div className="mb-8">
          <NewsletterForm variant="inline" source="coming-soon" />
        </div>
        <Link
          href="/blog"
          className="inline-block text-ink-secondary underline hover:text-ink-primary transition-colors"
        >
          Enquanto isso, leia nossos artigos →
        </Link>
      </div>
    </main>
  );
}
