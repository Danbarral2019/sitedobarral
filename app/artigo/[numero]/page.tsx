'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, FileText, BookOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import { LEI_14133_ARTIGOS, LeiArticle } from '@/data/lei-14133-artigos';
import LeiArticleBadge from '@/components/LeiArticleBadge';

interface Document {
  id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  courseId: string;
  isPublic: boolean;
  url?: string;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
}

export default function ArtigoPage() {
  const params = useParams();
  const router = useRouter();
  const numero = params?.numero as string;

  const [article, setArticle] = useState<LeiArticle | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<Document[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Valida e carrega o artigo
    if (!numero || !LEI_14133_ARTIGOS[numero]) {
      router.push('/');
      return;
    }

    setArticle(LEI_14133_ARTIGOS[numero]);

    // Carrega documentos e posts relacionados
    loadRelatedContent(numero);
  }, [numero, router]);

  const loadRelatedContent = async (articleNumber: string) => {
    setIsLoading(true);
    try {
      // Busca documentos relacionados
      const docsResponse = await fetch(`/api/artigos/${articleNumber}/documents`);
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        setRelatedDocuments(docsData.documents || []);
      }

      // Busca posts relacionados
      const postsResponse = await fetch(`/api/artigos/${articleNumber}/blog-posts`);
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setRelatedPosts(postsData.posts || []);
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdo relacionado:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!article) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  const publicDocuments = relatedDocuments.filter(doc => doc.isPublic);
  const restrictedDocuments = relatedDocuments.filter(doc => !doc.isPublic);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Início
          </Link>

          <div className="flex items-start gap-4">
            <FileText className="w-12 h-12 flex-shrink-0" />
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Artigo {article.numero}
              </h1>
              <p className="text-xl text-white/90 mb-4">
                Lei 14.133/2021 - Nova Lei de Licitações e Contratos
              </p>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <p className="text-lg leading-relaxed">
                  {article.ementa}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
              {article.capitulo}
            </span>
            {article.secao && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                {article.secao}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-8">
              {/* Link para texto completo */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-orange-600" />
                  Texto Completo da Lei
                </h2>
                <p className="text-gray-700 mb-4">
                  Consulte o texto integral do artigo {article.numero} no site oficial do Planalto.
                </p>
                <a
                  href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-md"
                >
                  <ExternalLink className="w-5 h-5" />
                  Ver Lei Completa
                </a>
              </div>

              {/* Posts do Blog Relacionados */}
              {relatedPosts.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    📝 Posts Relacionados ({relatedPosts.length})
                  </h2>
                  <div className="space-y-4">
                    {relatedPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border-2 border-transparent hover:border-blue-300"
                      >
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                          {post.excerpt}
                        </p>
                        <div className="text-xs text-gray-500">
                          Por {post.author} • {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos Públicos */}
              {publicDocuments.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    📄 Documentos Públicos ({publicDocuments.length})
                  </h2>
                  <div className="space-y-3">
                    {publicDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors"
                      >
                        <h3 className="font-bold text-gray-900 mb-1">
                          {doc.title}
                        </h3>
                        {doc.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">
                            Público
                          </span>
                          <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded font-medium">
                            {doc.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos Restritos */}
              {restrictedDocuments.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    🔒 Documentos Exclusivos ({restrictedDocuments.length})
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Acesse a área restrita para visualizar materiais exclusivos relacionados a este artigo.
                  </p>
                  <Link
                    href="/area-restrita"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md"
                  >
                    Acessar Área Restrita
                  </Link>
                </div>
              )}

              {/* Mensagem se não houver conteúdo */}
              {relatedPosts.length === 0 && relatedDocuments.length === 0 && (
                <div className="bg-yellow-50 rounded-2xl shadow-lg p-8 border-2 border-yellow-200 text-center">
                  <p className="text-gray-700 text-lg">
                    Ainda não há conteúdo específico catalogado para este artigo.
                  </p>
                  <p className="text-gray-600 mt-2">
                    Navegue pelos nossos cursos e materiais para encontrar conteúdo relacionado.
                  </p>
                  <Link
                    href="/cursos"
                    className="inline-block mt-4 px-6 py-3 bg-yellow-600 text-white rounded-xl font-bold hover:bg-yellow-700 transition-all"
                  >
                    Ver Cursos
                  </Link>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Artigos Relacionados */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Artigos Relacionados
                </h3>
                <div className="space-y-2">
                  {/* Artigo anterior */}
                  {parseInt(numero) > 1 && LEI_14133_ARTIGOS[String(parseInt(numero) - 1)] && (
                    <Link
                      href={`/artigo/${parseInt(numero) - 1}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-xs text-gray-500 mb-1">← Artigo Anterior</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        Art. {parseInt(numero) - 1}
                      </div>
                    </Link>
                  )}

                  {/* Artigo seguinte */}
                  {parseInt(numero) < 193 && LEI_14133_ARTIGOS[String(parseInt(numero) + 1)] && (
                    <Link
                      href={`/artigo/${parseInt(numero) + 1}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-xs text-gray-500 mb-1">Próximo Artigo →</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        Art. {parseInt(numero) + 1}
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* CTA Cursos */}
              <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl shadow-lg p-6 text-white">
                <h3 className="text-xl font-bold mb-3">
                  Aprofunde seus conhecimentos
                </h3>
                <p className="text-white/90 mb-4 text-sm">
                  Conheça nossos cursos especializados em Lei 14.133/2021
                </p>
                <Link
                  href="/cursos"
                  className="block w-full text-center px-4 py-2 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors"
                >
                  Ver Cursos
                </Link>
              </div>

              {/* CTA Newsletter */}
              <div className="bg-blue-50 rounded-2xl shadow-lg p-6 border-2 border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  📬 Fique Atualizado
                </h3>
                <p className="text-gray-700 mb-4 text-sm">
                  Receba novos conteúdos e atualizações sobre a Lei 14.133/2021
                </p>
                <Link
                  href="/#newsletter"
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  Assinar Newsletter
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
