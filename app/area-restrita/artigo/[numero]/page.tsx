'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, FileText, ArrowLeft, ExternalLink, Heart, Filter, X, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react';
import { LEI_14133_ARTIGOS as LEI_14133_ARTIGOS_FALLBACK, LeiArticle } from '@/data/lei-14133-artigos';
import { ArticleRelationshipGraph } from '@/components/ArticleRelationshipGraph';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import DocumentDetailModal from '@/components/DocumentDetailModal';

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
  // Campos de enunciados
  entityType?: string | null;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'orientacao-normativa': 'Orientação Normativa',
  'parecer-vinculante': 'Parecer Vinculante',
  'decor': 'DECOR',
  'acordao': 'Acórdão TCU',
  'enunciados': 'Enunciado',
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'Instrução Normativa',
  'lei': 'Lei',
  'legislative-act': 'Ato Normativo',
  'outro': 'Outro',
};

const CATEGORY_TIER: Record<string, number> = {
  // Tier 1 — Materiais do professor
  'apostila': 1, 'conteudo-programatico': 1, 'outro': 1,
  'bibliografia': 1, 'sumula': 1, 'parecer': 1,
  // Tier 2 — Enunciados e ONs
  'enunciados': 2, 'orientacao-normativa': 2,
  // Tier 3 — Acórdãos e manuais
  'acordao': 3, 'manual-tcu': 3,
  // Tier 4 — DECOR e pareceres vinculantes
  'decor': 4, 'parecer-vinculante': 4,
  // Tier 5 — Atos legislativos
  'legislative-act': 5,
};

function getTier(category: string): number {
  return CATEGORY_TIER[category] ?? 10;
}

function getTierCardStyle(tier: number): string {
  if (tier === 1) return 'bg-brand-50/40 hover:bg-brand-50 border-brand-200/50 hover:border-brand-300';
  if (tier === 2) return 'bg-indigo-50/30 hover:bg-indigo-50 border-indigo-200/50 hover:border-indigo-300';
  return 'bg-gray-50 hover:bg-blue-50 border-transparent hover:border-blue-200';
}

function getTierBadgeStyle(tier: number): string {
  if (tier === 1) return 'bg-brand-100 text-brand-800 font-semibold';
  if (tier === 2) return 'bg-indigo-100 text-indigo-700';
  return 'bg-blue-100 text-blue-700';
}

function getTierSidebarStyle(tier: number, isSelected: boolean): string {
  if (!isSelected) return 'hover:bg-gray-50 text-gray-500';
  if (tier === 1) return 'bg-brand-100 text-brand-800 font-semibold';
  if (tier === 2) return 'bg-indigo-100 text-indigo-800 font-semibold';
  return 'bg-blue-100 text-blue-800 font-semibold';
}

export default function ArtigoAreaRestritaPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const numero = params?.numero as string;

  const [artigos, setArtigos] = useState<Record<string, LeiArticle>>(LEI_14133_ARTIGOS_FALLBACK);
  const [article, setArticle] = useState<LeiArticle | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<Document[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Buscar artigos do banco
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
      }
    }
    fetchArtigos();
  }, []);

  useEffect(() => {
    if (!numero || !artigos[numero]) {
      router.push('/area-restrita');
      return;
    }
    setArticle(artigos[numero]);
    loadRelatedContent(numero);
  }, [numero, artigos, router]);

  const loadRelatedContent = async (articleNumber: string) => {
    setIsLoading(true);
    try {
      const [docsRes, postsRes] = await Promise.all([
        fetch(`/api/artigos/${articleNumber}/documents`),
        fetch(`/api/artigos/${articleNumber}/blog-posts`),
      ]);

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setRelatedDocuments(docsData.documents || []);
      }
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setRelatedPosts(postsData.posts || []);
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdo relacionado:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !article) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-600" />
      </main>
    );
  }

  if (!user) return null;

  const enrolledCourseId = user.enrollments?.[0]?.courseId || '';

  // Agrupar documentos por categoria
  const docsByCategory: Record<string, Document[]> = {};
  relatedDocuments.forEach((doc) => {
    const cat = doc.sourceType === 'legislative-act' ? 'legislative-act' : doc.category;
    if (!docsByCategory[cat]) docsByCategory[cat] = [];
    docsByCategory[cat].push(doc);
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-8 lg:py-12">
        <div className="max-w-6xl mx-auto px-4">
          <Link
            href="/area-restrita"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Área Restrita
          </Link>

          <div className="flex items-start gap-4">
            <FileText className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0" />
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold mb-2">
                Artigo {article.numero}{parseInt(article.numero) <= 9 ? 'o' : ''}
              </h1>
              <p className="text-lg text-white/90 mb-4">
                Lei 14.133/2021 - Nova Lei de Licitações
              </p>

              {(article.titulo || article.capituloCompleto) && (
                <div className="mb-4 space-y-1">
                  {article.titulo && (
                    <p className="text-base font-bold text-white/95">{article.titulo}</p>
                  )}
                  {article.capituloCompleto && (
                    <p className="text-base font-bold text-white/95">{article.capituloCompleto}</p>
                  )}
                </div>
              )}

              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
                <p className="text-base leading-relaxed whitespace-pre-line">
                  {article.ementa.length > 800 && !isContentExpanded
                    ? article.ementa.substring(0, 400) + '...'
                    : article.ementa}
                </p>
                {article.ementa.length > 800 && (
                  <button
                    onClick={() => setIsContentExpanded(!isContentExpanded)}
                    className="mt-3 text-white/90 hover:text-white font-medium text-sm underline"
                  >
                    {isContentExpanded ? 'Ler Menos' : 'Ler Mais'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Banner de filtro ativo */}
              {selectedCategory && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Filter className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-blue-900">
                        Filtrando por: {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                      </span>
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        {docsByCategory[selectedCategory]?.length || 0} documento{(docsByCategory[selectedCategory]?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpar filtro
                  </button>
                </div>
              )}

              {/* Artigos Relacionados Graph - oculto quando filtro ativo */}
              {!selectedCategory && (
                <ArticleRelationshipGraph
                  articleNumber={numero}
                  onArticleClick={(articleNum) => {
                    router.push(`/area-restrita/artigo/${articleNum}`);
                  }}
                />
              )}

              {/* Blog Posts - ocultos quando filtro ativo */}
              {!selectedCategory && relatedPosts.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Posts Relacionados ({relatedPosts.length})
                  </h2>
                  <div className="space-y-3">
                    {relatedPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
                      >
                        <h3 className="font-bold text-gray-900 mb-1">{post.title}</h3>
                        <p className="text-gray-600 text-sm mb-1">{post.excerpt}</p>
                        <span className="text-xs text-gray-500">
                          Por {post.author} - {new Date(post.publishedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents by Category */}
              {relatedDocuments.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Documentos Vinculados ({selectedCategory ? (docsByCategory[selectedCategory]?.length || 0) : relatedDocuments.length})
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Clique para ver detalhes completos e acessar o documento
                  </p>

                  <div className="space-y-6">
                    {Object.entries(docsByCategory)
                      .filter(([category]) => !selectedCategory || category === selectedCategory)
                      .sort((a, b) => {
                        const tierA = getTier(a[0]);
                        const tierB = getTier(b[0]);
                        if (tierA !== tierB) return tierA - tierB;
                        return b[1].length - a[1].length;
                      })
                      .map(([category, docs]) => {
                        const tier = getTier(category);
                        return (
                        <div key={category}>
                          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${getTierBadgeStyle(tier)}`}>
                              {CATEGORY_LABELS[category] || category}
                            </span>
                            <span className="text-gray-400 font-normal">{docs.length}</span>
                          </h3>
                          <div className="space-y-2">
                            {docs.map((doc) => (
                              <div key={doc.id} className="space-y-0">
                                <button
                                  onClick={() => {
                                    if (doc.sourceType === 'legislative-act') {
                                      router.push(`/legislacao/${doc.id}`);
                                    } else {
                                      setSelectedDocId(doc.id);
                                    }
                                  }}
                                  className={`w-full text-left p-3 rounded-lg transition-colors border group ${getTierCardStyle(tier)} ${doc.summary && expandedSummaryId === doc.id ? 'rounded-b-none border-b-0' : ''}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <h4 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 truncate">
                                          {doc.metaTcu?.numeroAcordao || doc.title}
                                        </h4>
                                        {doc.url && (
                                          <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                        )}
                                        {/* Badge entityType para enunciados */}
                                        {doc.entityType && (
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            doc.entityType === 'CJF' ? 'bg-emerald-100 text-emerald-700' :
                                            doc.entityType === 'IBDA' ? 'bg-amber-100 text-amber-700' :
                                            doc.entityType === 'INCP' ? 'bg-violet-100 text-violet-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {doc.entityType}
                                          </span>
                                        )}
                                        {/* Badge órgão julgador TCU */}
                                        {doc.category === 'acordao' && doc.metaTcu?.orgaoJulgador && (
                                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                            {doc.metaTcu.orgaoJulgador}
                                          </span>
                                        )}
                                      </div>
                                      {/* Metadados TCU enriquecidos para acórdãos */}
                                      {doc.category === 'acordao' && (doc.metaTcu?.relator || doc.metaTcu?.dataJulgamento) && (
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-500">
                                          {doc.metaTcu?.relator && (
                                            <span className="flex items-center gap-1">
                                              <User className="w-3 h-3" />
                                              Rel. {doc.metaTcu.relator}
                                            </span>
                                          )}
                                          {doc.metaTcu?.dataJulgamento && (
                                            <span className="flex items-center gap-1">
                                              <Calendar className="w-3 h-3" />
                                              {new Date(doc.metaTcu.dataJulgamento).toLocaleDateString('pt-BR')}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {/* Badges de área/tema TCU */}
                                      {doc.category === 'acordao' && (doc.metaTcu?.area || doc.metaTcu?.tema) && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {doc.metaTcu?.area && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                              {doc.metaTcu.area}
                                            </span>
                                          )}
                                          {doc.metaTcu?.tema && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                              {doc.metaTcu.tema}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {doc.description && !doc.metaTcu?.numeroAcordao && (
                                        <p className="text-xs text-gray-600 line-clamp-2">
                                          {doc.description.substring(0, 150)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {/* Botão Ver resumo */}
                                      {doc.summary && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedSummaryId(expandedSummaryId === doc.id ? null : doc.id);
                                          }}
                                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                          title="Ver resumo"
                                        >
                                          {expandedSummaryId === doc.id ? (
                                            <ChevronUp className="w-4 h-4" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </button>
                                      )}
                                      {doc.sourceType !== 'legislative-act' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFavorite(doc.id, enrolledCourseId);
                                          }}
                                          className={`p-1.5 rounded-lg transition-colors ${
                                            isFavorite(doc.id)
                                              ? 'text-red-600 bg-red-100'
                                              : 'text-gray-300 hover:text-red-600'
                                          }`}
                                        >
                                          <Heart className={`w-4 h-4 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </button>
                                {/* Summary expandível */}
                                {doc.summary && expandedSummaryId === doc.id && (
                                  <div className="px-3 pb-3 pt-2 bg-blue-50/50 border border-t-0 border-blue-200/50 rounded-b-lg text-xs text-gray-700 leading-relaxed">
                                    <p>{doc.summary}</p>
                                    {doc.summaryHighlights && (() => {
                                      try {
                                        const highlights = JSON.parse(doc.summaryHighlights) as string[];
                                        if (highlights.length > 0) {
                                          return (
                                            <ul className="mt-2 space-y-1">
                                              {highlights.map((h, i) => (
                                                <li key={i} className="flex items-start gap-1.5">
                                                  <span className="text-blue-500 mt-0.5 flex-shrink-0">-</span>
                                                  <span>{h}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          );
                                        }
                                      } catch { /* ignore parse errors */ }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 text-center">
                  <p className="text-gray-500">
                    Ainda nao ha documentos vinculados a este artigo.
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Article Navigation */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Navegacao</h3>
                <div className="space-y-2">
                  {parseInt(numero) > 1 && artigos[String(parseInt(numero) - 1)] && (
                    <Link
                      href={`/area-restrita/artigo/${parseInt(numero) - 1}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-xs text-gray-500 mb-1">Artigo Anterior</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        Art. {parseInt(numero) - 1}
                      </div>
                    </Link>
                  )}
                  {artigos[String(parseInt(numero) + 1)] && (
                    <Link
                      href={`/area-restrita/artigo/${parseInt(numero) + 1}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <div className="text-xs text-gray-500 mb-1">Proximo Artigo</div>
                      <div className="font-semibold text-gray-900 text-sm">
                        Art. {parseInt(numero) + 1}
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Resumo</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Documentos</span>
                    <span className="font-bold text-gray-900">{relatedDocuments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Posts</span>
                    <span className="font-bold text-gray-900">{relatedPosts.length}</span>
                  </div>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium text-left mb-1"
                    >
                      Mostrar todos
                    </button>
                  )}
                  {Object.entries(docsByCategory)
                    .sort((a, b) => {
                      const tierA = getTier(a[0]);
                      const tierB = getTier(b[0]);
                      if (tierA !== tierB) return tierA - tierB;
                      return b[1].length - a[1].length;
                    })
                    .map(([cat, docs]) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className={`w-full flex items-center justify-between text-sm p-2 rounded-lg transition-colors ${
                        getTierSidebarStyle(getTier(cat), selectedCategory === cat)
                      }`}
                    >
                      <span>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className={`${selectedCategory === cat ? 'font-bold' : 'text-gray-700'}`}>{docs.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document Detail Modal */}
      {selectedDocId && (
        <DocumentDetailModal
          documentId={selectedDocId}
          onClose={() => setSelectedDocId(null)}
          isFavorite={isFavorite(selectedDocId)}
          onToggleFavorite={() => toggleFavorite(selectedDocId, enrolledCourseId)}
        />
      )}
    </main>
  );
}
