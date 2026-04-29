'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, FileText, BookOpen, ArrowLeft, BarChart3, TrendingUp, Scale, Calendar, User } from 'lucide-react';
import type { LeiArticle } from '@/data/lei-14133-artigos';
import { ArticleRelationshipGraph } from '@/components/ArticleRelationshipGraph';
import JurisprudenciaRelacionada from '@/components/JurisprudenciaRelacionada';
import { isLiteralSourceCategory } from '@/lib/literal-sources';


interface Document {
  id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  courseId: string | null;
  isPublic: boolean;
  url?: string;
  uploadedAt?: string;
  leiArticles?: string | null;
  sourceType?: 'document' | 'legislative-act';
  // Campos específicos de atos legislativos
  fullNumber?: string;
  issuer?: string;
  ementa?: string;
  // Campos TCU enriquecidos (via metaTcu satellite table)
  metaTcu?: {
    numeroAcordao?: string | null;
    relator?: string | null;
    orgaoJulgador?: string | null;
    dataJulgamento?: string | null;
    area?: string | null;
    tema?: string | null;
  } | null;
  summary?: string | null;
  summaryHighlights?: string | null;
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

  const [artigos, setArtigos] = useState<Record<string, LeiArticle> | null>(null);
  const [article, setArticle] = useState<LeiArticle | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<Document[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  // Buscar artigos do banco de dados ao montar componente
  useEffect(() => {
    async function fetchArtigos() {
      try {
        const response = await fetch('/api/lei-14133/artigos');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.artigos) {
            setArtigos(data.artigos);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar artigos:', error);
        // API falhou, artigos continua null
      }
    }
    fetchArtigos();
  }, []);

  useEffect(() => {
    if (!artigos || !numero) return;
    if (!artigos[numero]) {
      router.push('/');
      return;
    }

    setArticle(artigos[numero]);

    // Carrega documentos e posts relacionados
    loadRelatedContent(numero);
  }, [numero, artigos, router]);

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

  if (!artigos || !article) {
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
            href="/lei-14133"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Lei 14.133
          </Link>

          <div className="flex items-start gap-4">
            <FileText className="w-12 h-12 flex-shrink-0" />
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Artigo {article.numero}{parseInt(article.numero) <= 9 ? 'º' : ''}
              </h1>
              <p className="text-xl text-white/90 mb-4">
                <a
                  href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline hover:text-white transition-all"
                >
                  Lei de Licitações e Contratos Administrativos
                </a>
              </p>

              {/* Título e Capítulo */}
              {(article.titulo || article.capituloCompleto) && (
                <div className="mb-4 space-y-2">
                  {article.titulo && (
                    <p className="text-lg font-bold text-white/95">
                      {article.titulo}
                    </p>
                  )}
                  {article.capituloCompleto && (
                    <p className="text-lg font-bold text-white/95">
                      {article.capituloCompleto}
                    </p>
                  )}
                </div>
              )}

              {/* Texto oficial do artigo */}
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <p className="text-lg leading-relaxed whitespace-pre-line">
                  {article.ementa.length > 800 && !isContentExpanded
                    ? article.ementa.substring(0, 400) + '...'
                    : article.ementa
                  }
                </p>
                {article.ementa.length > 800 && (
                  <button
                    onClick={() => setIsContentExpanded(!isContentExpanded)}
                    className="mt-3 text-white/90 hover:text-white font-medium text-sm underline"
                  >
                    {isContentExpanded ? '← Ler Menos' : 'Ler Mais →'}
                  </button>
                )}
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
              {/* Artigos Relacionados */}
              <ArticleRelationshipGraph
                articleNumber={numero}
                artigos={artigos}
                onArticleClick={(articleNum) => {
                  router.push(`/artigo/${articleNum}`);
                }}
              />

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

              {/* Jurisprudência Relacionada */}
              <JurisprudenciaRelacionada articleNumber={numero} />

              {/* Preview de Documentos - Área Pública */}
              {publicDocuments.length > 0 && (
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-2">
                        {publicDocuments.length} Documentos Indexados
                      </h2>
                      <p className="text-white/90 text-lg">
                        Análises, pareceres e orientações sobre este artigo
                      </p>
                    </div>
                  </div>

                  {/* Preview das Categorias */}
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const categories: Record<string, number> = {};
                      publicDocuments.forEach(doc => {
                        categories[doc.category] = (categories[doc.category] || 0) + 1;
                      });

                      // Mapear nomes das categorias
                      const categoryNames: Record<string, string> = {
                        'orientacao-normativa': 'Orientações Normativas',
                        'parecer-vinculante': 'Pareceres Vinculantes',
                        'decor': 'DECOR',
                        'acordao': 'Acórdãos',
                        'outro': 'Outros',
                      };

                      return Object.entries(categories).map(([cat, count]) => (
                        <div key={cat} className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold">{count as number}</div>
                          <div className="text-xs text-white/90">{categoryNames[cat] || cat}</div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Preview dos primeiros 3 documentos */}
                  <div className="space-y-3 mb-6">
                    {(() => {
                      // Mapear nomes das categorias
                      const categoryNames: Record<string, string> = {
                        'orientacao-normativa': 'Orientação Normativa',
                        'parecer-vinculante': 'Parecer Vinculante',
                        'decor': 'DECOR',
                        'acordao': 'Acórdão',
                        'outro': 'Outro',
                      };

                      return publicDocuments.slice(0, 3).map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                                  {categoryNames[doc.category] || doc.category}
                                </span>
                                {doc.category === 'acordao' && doc.metaTcu?.orgaoJulgador && (
                                  <span className="px-2 py-0.5 bg-white/10 rounded text-xs">
                                    {doc.metaTcu.orgaoJulgador}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-white line-clamp-1">
                                {doc.metaTcu?.numeroAcordao || doc.title}
                              </h3>
                              {/* Metadados TCU enriquecidos */}
                              {doc.category === 'acordao' && (doc.metaTcu?.relator || doc.metaTcu?.dataJulgamento || doc.metaTcu?.area) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-white/70">
                                  {doc.metaTcu?.relator && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {doc.metaTcu.relator}
                                    </span>
                                  )}
                                  {doc.metaTcu?.dataJulgamento && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(doc.metaTcu.dataJulgamento).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                  {doc.metaTcu?.area && (
                                    <span className="flex items-center gap-1">
                                      <Scale className="w-3 h-3" />
                                      {doc.metaTcu.area}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Summary IA quando disponível (não-literais); description em fontes literais (enunciados). Ver lib/literal-sources.ts. */}
                              {!isLiteralSourceCategory(doc.category) && doc.summary ? (
                                <p className="text-sm text-white/80 line-clamp-2 mt-1">
                                  {doc.summary}
                                </p>
                              ) : doc.description ? (
                                <p className="text-sm text-white/80 line-clamp-2 mt-1">
                                  {doc.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                              {doc.category === 'acordao' ? (
                                <Scale className="w-4 h-4" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                    {publicDocuments.length > 3 && (
                      <div className="text-center py-2">
                        <span className="text-white/80 text-sm font-medium">
                          + {publicDocuments.length - 3} documentos adicionais
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="pt-6 border-t border-white/20">
                    <p className="text-center text-white/90 mb-4 text-sm">
                      🔒 Acesse a <strong>análise completa, PDFs e conteúdo exclusivo</strong> de todos os documentos
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        href="/area-restrita"
                        className="flex-1 text-center px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg"
                      >
                        Entrar na Área Restrita
                      </Link>
                      <Link
                        href="/cursos"
                        className="flex-1 text-center px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/30 transition-all border-2 border-white/30"
                      >
                        Conhecer Cursos
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentos Restritos - CTA Melhorado */}
              {restrictedDocuments.length > 0 && (
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-2">
                        {restrictedDocuments.length} {restrictedDocuments.length === 1 ? 'Documento Exclusivo' : 'Documentos Exclusivos'}
                      </h2>
                      <p className="text-white/90 text-sm">
                        Material adicional disponível para alunos matriculados
                      </p>
                    </div>
                  </div>

                  {/* Preview dos tipos de documentos restritos */}
                  <div className="mb-6 flex flex-wrap gap-2">
                    {[...new Set(restrictedDocuments.map(d => d.category))].slice(0, 4).map((category) => (
                      <span key={category} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        {category}
                      </span>
                    ))}
                    {[...new Set(restrictedDocuments.map(d => d.category))].length > 4 && (
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        +{[...new Set(restrictedDocuments.map(d => d.category))].length - 4} mais
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/area-restrita"
                      className="flex-1 text-center px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg"
                    >
                      Acessar Área Restrita
                    </Link>
                    <Link
                      href="/cursos"
                      className="flex-1 text-center px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/30 transition-all border-2 border-white/30"
                    >
                      Conhecer Cursos
                    </Link>
                  </div>
                </div>
              )}

              {/* Mensagem se não houver conteúdo */}
              {relatedPosts.length === 0 && relatedDocuments.length === 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg p-8 border-2 border-yellow-200">
                  <div className="text-center mb-6">
                    <div className="inline-flex p-4 bg-yellow-100 rounded-full mb-4">
                      <TrendingUp className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Conteúdo em Desenvolvimento
                    </h3>
                    <p className="text-gray-700 text-lg mb-2">
                      Ainda não há conteúdo específico catalogado para este artigo.
                    </p>
                    <p className="text-gray-600">
                      Estamos constantemente atualizando nosso acervo com novos materiais.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Link
                      href="/cursos"
                      className="flex flex-col items-center p-4 bg-white rounded-xl hover:shadow-md transition-all border-2 border-transparent hover:border-yellow-300"
                    >
                      <BookOpen className="w-6 h-6 text-yellow-600 mb-2" />
                      <span className="font-bold text-gray-900">Ver Cursos</span>
                      <span className="text-xs text-gray-600 mt-1">Explore nossos cursos especializados</span>
                    </Link>

                    <Link
                      href="/area-restrita"
                      className="flex flex-col items-center p-4 bg-white rounded-xl hover:shadow-md transition-all border-2 border-transparent hover:border-blue-300"
                    >
                      <FileText className="w-6 h-6 text-blue-600 mb-2" />
                      <span className="font-bold text-gray-900">Área Restrita</span>
                      <span className="text-xs text-gray-600 mt-1">Acesse materiais exclusivos</span>
                    </Link>
                  </div>
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
                  {parseInt(numero) > 1 && artigos[String(parseInt(numero) - 1)] && (
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
                  {parseInt(numero) < 194 && artigos[String(parseInt(numero) + 1)] && (
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

              {/* CTA Cursos - Melhorado */}
              <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold">
                      Aprofunde seus conhecimentos
                    </h3>
                  </div>
                  <p className="text-white/90 mb-4 text-sm">
                    Cursos especializados em Lei 14.133/2021 com materiais exclusivos e certificado
                  </p>
                  <Link
                    href="/cursos"
                    className="block w-full text-center px-4 py-3 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-all shadow-md hover:shadow-lg"
                  >
                    Ver Cursos Disponíveis
                  </Link>
                </div>
              </div>

              {/* CTA Newsletter - Melhorado */}
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>

                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold">
                      Fique Atualizado
                    </h3>
                  </div>
                  <p className="text-white/90 mb-4 text-sm">
                    Newsletter mensal com novos conteúdos, jurisprudência e análises sobre a Lei 14.133/2021
                  </p>
                  <Link
                    href="/#newsletter"
                    className="block w-full text-center px-4 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-all shadow-md hover:shadow-lg"
                  >
                    Assinar Newsletter Grátis
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
