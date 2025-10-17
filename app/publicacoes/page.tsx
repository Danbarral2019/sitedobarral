import { prisma } from '@/lib/prisma';
import { BookOpen, FileText, Calendar, ExternalLink, MapPin } from 'lucide-react';
import Link from 'next/link';

export default async function PublicacoesPage() {
  const publications = await prisma.publication.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' }
  });

  const livros = publications.filter(p => p.type === 'livro');
  const artigos = publications.filter(p => p.type === 'artigo');
  const noticias = publications.filter(p => p.type === 'noticia');

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <main className="py-12 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-gray-900">Publicações Acadêmicas</h1>
              <div className="h-1.5 w-40 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Livros, artigos científicos e notícias relevantes sobre Direito Administrativo
            </p>
          </div>

          {/* Seção de Livros */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Livros</h2>
            </div>

            {livros.length === 0 ? (
              <p className="text-gray-600 text-center py-12 bg-gray-50 rounded-xl">
                Nenhum livro publicado ainda.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {livros.map((livro) => (
                  <div key={livro.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all group border-2 border-gray-100 hover:border-blue-500">
                    {livro.coverImage && (
                      <div className="aspect-[3/4] bg-gray-200 overflow-hidden">
                        <img
                          src={livro.coverImage}
                          alt={livro.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                        {livro.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">por {livro.author}</p>
                      {livro.publisher && (
                        <p className="text-sm text-gray-700 mb-2">
                          <span className="font-semibold">Editora:</span> {livro.publisher}
                        </p>
                      )}
                      {livro.isbn && (
                        <p className="text-xs text-gray-600 mb-3">
                          ISBN: {livro.isbn}
                        </p>
                      )}
                      <p className="text-gray-700 mb-4 line-clamp-3 text-sm">
                        {livro.description}
                      </p>
                      <div className="flex items-center text-xs text-gray-600">
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
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Artigos Científicos</h2>
            </div>

            {artigos.length === 0 ? (
              <p className="text-gray-600 text-center py-12 bg-gray-50 rounded-xl">
                Nenhum artigo publicado ainda.
              </p>
            ) : (
              <div className="space-y-6">
                {artigos.map((artigo) => (
                  <div key={artigo.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all border-l-4 border-purple-500">
                    <h3 className="text-2xl font-bold mb-2 text-gray-900">
                      {artigo.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      por {artigo.author}
                      {artigo.journal && <span className="ml-2">· {artigo.journal}</span>}
                    </p>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {artigo.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(artigo.publishedAt)}
                      </div>
                      {artigo.externalUrl && (
                        <a
                          href={artigo.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
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
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl flex items-center justify-center">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Notícias & Eventos</h2>
            </div>

            {noticias.length === 0 ? (
              <p className="text-gray-600 text-center py-12 bg-gray-50 rounded-xl">
                Nenhuma notícia ou evento publicado ainda.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {noticias.map((noticia) => (
                  <div key={noticia.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all border-2 border-gray-100 hover:border-pink-500">
                    <h3 className="text-xl font-bold mb-2 text-gray-900">
                      {noticia.title}
                    </h3>
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {noticia.description}
                    </p>
                    <div className="space-y-2 text-sm text-gray-600">
                      {noticia.eventDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-pink-600" />
                          <span className="font-semibold">Data:</span> {formatDate(noticia.eventDate)}
                        </div>
                      )}
                      {noticia.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-pink-600" />
                          <span className="font-semibold">Local:</span> {noticia.location}
                        </div>
                      )}
                      {noticia.externalUrl && (
                        <div className="mt-4">
                          <a
                            href={noticia.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-pink-600 font-semibold hover:text-pink-700"
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
