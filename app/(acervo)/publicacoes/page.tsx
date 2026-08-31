import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { BookOpen, FileText, Calendar, ExternalLink, MapPin } from 'lucide-react';
// import Link from 'next/link';
import { Publication } from '@prisma/client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Publicações Acadêmicas',
  description: 'Livros, artigos científicos e notícias sobre Direito Administrativo, Licitações e Contratos publicados pelo Prof. Daniel Barral.',
  keywords: [
    'publicações direito administrativo',
    'livros licitações',
    'artigos contratos administrativos',
    'publicações acadêmicas',
    'Daniel Barral livros',
    'pesquisa direito público',
  ],
  openGraph: {
    title: 'Publicações Acadêmicas | Prof. Daniel Barral',
    description: 'Livros, artigos científicos e notícias sobre Direito Administrativo, Licitações e Contratos',
    url: 'https://profdanielbarral.com/publicacoes',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Publicações Acadêmicas | Prof. Daniel Barral',
    description: 'Livros, artigos científicos e notícias sobre Direito Administrativo',
  },
  alternates: {
    canonical: '/publicacoes',
  },
};

// Revalidar a cada 1 hora
export const revalidate = 3600;

export default async function PublicacoesPage() {
  let publications: Publication[] = [];
  try {
    publications = await prisma.publication.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' }
    });
  } catch {
    // Database unavailable (e.g. CI build)
  }

  const livros = publications.filter((p: Publication) => p.type === 'livro');
  const artigos = publications.filter((p: Publication) => p.type === 'artigo');
  const noticias = publications.filter((p: Publication) => p.type === 'noticia');

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <main className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-ink-primary font-heading">Publicações Acadêmicas</h1>
              <div className="h-1.5 w-40 bg-brand-500 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-ink-secondary max-w-3xl mx-auto leading-relaxed">
              Livros, artigos científicos e notícias relevantes sobre Direito Administrativo
            </p>
          </div>

          {/* Seção de Livros */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-700 rounded-[6px] flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-ink-primary">Livros</h2>
            </div>

            {livros.length === 0 ? (
              <p className="text-ink-muted text-center py-12 bg-surface-raised rounded-[6px]">
                Nenhum livro publicado ainda.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {livros.map((livro: Publication) => (
                  <div key={livro.id} className="bg-white rounded-[6px] overflow-hidden hover: transition-all group border-2 border-border-subtle hover:border-brand-500">
                    {livro.coverImage && (
                      <div className="aspect-[3/4] bg-surface-deep overflow-hidden relative">
                        <Image
                          src={livro.coverImage}
                          alt={livro.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 text-ink-primary line-clamp-2 group-hover:text-brand-700 transition-colors">
                        {livro.title}
                      </h3>
                      <p className="text-sm text-ink-muted mb-2">por {livro.author}</p>
                      {livro.publisher && (
                        <p className="text-sm text-ink-secondary mb-2">
                          <span className="font-semibold">Editora:</span> {livro.publisher}
                        </p>
                      )}
                      {livro.isbn && (
                        <p className="text-xs text-ink-muted mb-3">
                          ISBN: {livro.isbn}
                        </p>
                      )}
                      <p className="text-ink-secondary mb-4 line-clamp-3 text-sm">
                        {livro.description}
                      </p>
                      <div className="flex items-center text-xs text-ink-muted">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(livro.publishedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seção de Artigos */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-700 rounded-[6px] flex items-center justify-center">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-ink-primary">Artigos Científicos</h2>
            </div>

            {artigos.length === 0 ? (
              <p className="text-ink-muted text-center py-12 bg-surface-raised rounded-[6px]">
                Nenhum artigo publicado ainda.
              </p>
            ) : (
              <div className="space-y-6">
                {artigos.map((artigo: Publication) => (
                  <div key={artigo.id} className="bg-white rounded-[6px] p-6 hover: transition-all border-l-4 border-brand-500">
                    <h3 className="text-2xl font-bold mb-2 text-ink-primary">
                      {artigo.title}
                    </h3>
                    <p className="text-sm text-ink-muted mb-3">
                      por {artigo.author}
                      {artigo.journal && <span className="ml-2">· {artigo.journal}</span>}
                    </p>
                    <p className="text-ink-secondary mb-4 leading-relaxed">
                      {artigo.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-ink-muted">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(artigo.publishedAt)}
                      </div>
                      {artigo.externalUrl && (
                        <a
                          href={artigo.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors"
                        >
                          Ler artigo
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seção de Notícias/Eventos */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-brand-700 rounded-[6px] flex items-center justify-center">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-ink-primary">Notícias & Eventos</h2>
            </div>

            {noticias.length === 0 ? (
              <p className="text-ink-muted text-center py-12 bg-surface-raised rounded-[6px]">
                Nenhuma notícia ou evento publicado ainda.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {noticias.map((noticia: Publication) => (
                  <div key={noticia.id} className="bg-white rounded-[6px] p-6 hover: transition-all border-2 border-border-subtle hover:border-brand-500">
                    <h3 className="text-xl font-bold mb-2 text-ink-primary">
                      {noticia.title}
                    </h3>
                    <p className="text-ink-secondary mb-4 leading-relaxed">
                      {noticia.description}
                    </p>
                    <div className="space-y-2 text-sm text-ink-muted">
                      {noticia.eventDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-brand-600" />
                          <span className="font-semibold">Data:</span> {formatDate(noticia.eventDate)}
                        </div>
                      )}
                      {noticia.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-brand-600" />
                          <span className="font-semibold">Local:</span> {noticia.location}
                        </div>
                      )}
                      {noticia.externalUrl && (
                        <div className="mt-4">
                          <a
                            href={noticia.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-brand-600 font-semibold hover:text-brand-700"
                          >
                            Saiba mais
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
