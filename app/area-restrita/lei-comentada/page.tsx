'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  Filter,
  Scale,
  BookOpen,
  Loader2,
  AlertCircle,
  Target,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';

// Dynamic import para evitar hydration mismatch
const DocumentDetailModal = dynamic(() => import('@/components/DocumentDetailModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
    </div>
  ),
});

interface LeiArticle {
  id: string;
  numero: string;
  titulo: string | null;
  capituloCompleto: string | null;
  ementa: string;
  capitulo: string;
  secao: string | null;
  documentCount: number;
  documents: {
    id: string;
    title: string;
    isPublic: boolean;
  }[];
}

interface HierarchyCapitulo {
  capituloCompleto: string;
  artigos: LeiArticle[];
}

interface HierarchyTitulo {
  titulo: string;
  capitulos: Record<string, HierarchyCapitulo>;
}

interface ApiResponse {
  articles: LeiArticle[];
  hierarchy: Record<string, HierarchyTitulo>;
  total: number;
  totalWithDocuments: number;
}

// Componente interno que usa useSearchParams
function LeiComentadaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  // Estado da API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);

  // Estado da UI
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithDocuments, setOnlyWithDocuments] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<LeiArticle | null>(null);
  const [expandedTitulos, setExpandedTitulos] = useState<Set<string>>(new Set());
  const [expandedCapitulos, setExpandedCapitulos] = useState<Set<string>>(new Set());

  // Modal de documentos
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Refs para scroll automático
  const articleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 1. Carregar dados da API
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/lei-14133/articles');

        if (!response.ok) {
          throw new Error('Erro ao carregar artigos da Lei 14.133');
        }

        const data: ApiResponse = await response.json();
        setApiData(data);

        // Expandir primeiro título por padrão
        const firstTitulo = Object.keys(data.hierarchy)[0];
        if (firstTitulo) {
          setExpandedTitulos(new Set([firstTitulo]));

          // Expandir primeiro capítulo do primeiro título
          const firstCapitulo = Object.keys(data.hierarchy[firstTitulo].capitulos)[0];
          if (firstCapitulo) {
            setExpandedCapitulos(new Set([`${firstTitulo}::${firstCapitulo}`]));
          }
        }
      } catch (err) {
        console.error('[Lei Comentada] Erro ao carregar:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // 2. Auto-scroll para artigo da URL
  useEffect(() => {
    const articleParam = searchParams?.get('artigo');

    if (articleParam && apiData && !loading) {
      // Encontrar artigo
      const article = apiData.articles.find((a) => a.numero === articleParam);

      if (article) {
        setSelectedArticle(article);

        // Expandir título e capítulo correspondentes
        if (article.titulo) {
          setExpandedTitulos((prev) => new Set([...prev, article.titulo!]));
        }

        const capituloKey = `${article.titulo}::${article.capitulo}`;
        setExpandedCapitulos((prev) => new Set([...prev, capituloKey]));

        // Scroll automático após 300ms (tempo para renderizar)
        setTimeout(() => {
          const ref = articleRefs.current[article.numero];
          if (ref) {
            ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }, [searchParams, apiData, loading]);

  // 3. Filtrar artigos por busca
  const filteredHierarchy = useMemo(() => {
    if (!apiData) return null;

    if (!searchQuery && !onlyWithDocuments) {
      return apiData.hierarchy;
    }

    const filtered: Record<string, HierarchyTitulo> = {};

    Object.entries(apiData.hierarchy).forEach(([tituloKey, tituloData]) => {
      const filteredCapitulos: Record<string, HierarchyCapitulo> = {};

      Object.entries(tituloData.capitulos).forEach(([capituloKey, capituloData]) => {
        const filteredArtigos = capituloData.artigos.filter((art) => {
          // Filtro de documentos
          if (onlyWithDocuments && art.documentCount === 0) {
            return false;
          }

          // Filtro de busca
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              art.numero.includes(query) ||
              art.ementa.toLowerCase().includes(query) ||
              (art.titulo && art.titulo.toLowerCase().includes(query))
            );
          }

          return true;
        });

        if (filteredArtigos.length > 0) {
          filteredCapitulos[capituloKey] = {
            ...capituloData,
            artigos: filteredArtigos,
          };
        }
      });

      if (Object.keys(filteredCapitulos).length > 0) {
        filtered[tituloKey] = {
          ...tituloData,
          capitulos: filteredCapitulos,
        };
      }
    });

    return filtered;
  }, [apiData, searchQuery, onlyWithDocuments]);

  // Handlers
  const toggleTitulo = (titulo: string) => {
    setExpandedTitulos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(titulo)) {
        newSet.delete(titulo);
      } else {
        newSet.add(titulo);
      }
      return newSet;
    });
  };

  const toggleCapitulo = (tituloKey: string, capituloKey: string) => {
    const key = `${tituloKey}::${capituloKey}`;
    setExpandedCapitulos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectArticle = (article: LeiArticle) => {
    setSelectedArticle(article);

    // Atualizar URL
    router.push(`/area-restrita/lei-comentada?artigo=${article.numero}`, { scroll: false });
  };

  const handleDocumentClick = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  };

  const getArticleStatus = (count: number) => {
    if (count === 0) return { label: 'Órfão', color: 'bg-red-100 text-red-700', icon: AlertCircle };
    if (count < 3) return { label: 'Escasso', color: 'bg-orange-100 text-orange-700', icon: TrendingUp };
    if (count < 6) return { label: 'Médio', color: 'bg-blue-100 text-blue-700', icon: Target };
    if (count < 15) return { label: 'Bom', color: 'bg-green-100 text-green-700', icon: CheckCircle };
    return { label: 'Excelente', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando Lei 14.133/2021...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !apiData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 text-center mb-2">
            Erro ao Carregar Lei
          </h2>
          <p className="text-red-700 text-center mb-4">{error || 'Erro desconhecido'}</p>
          <button
            onClick={() => router.push('/area-restrita')}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ← Voltar para Área Restrita
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Lei 14.133/2021 Comentada</h1>
              <p className="text-blue-100">
                Nova Lei de Licitações e Contratos Administrativos
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por artigo, palavra-chave..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={() => setOnlyWithDocuments(!onlyWithDocuments)}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                onlyWithDocuments
                  ? 'bg-white text-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              <Filter className="w-5 h-5" />
              {onlyWithDocuments ? 'Mostrar Todos' : 'Apenas com Docs'}
            </button>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{apiData.total} artigos</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>{apiData.totalWithDocuments} com documentos</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>{Math.round((apiData.totalWithDocuments / apiData.total) * 100)}% cobertura</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Estrutura da Lei */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
                <p className="text-sm text-gray-600">
                  {Object.keys(filteredHierarchy || {}).length} títulos
                </p>
              </div>

              <div className="p-2">
                {filteredHierarchy &&
                  Object.entries(filteredHierarchy).map(([tituloKey, tituloData]) => {
                    const isTituloExpanded = expandedTitulos.has(tituloKey);

                    return (
                      <div key={tituloKey} className="mb-2">
                        {/* TÍTULO */}
                        <button
                          onClick={() => toggleTitulo(tituloKey)}
                          className="w-full flex items-center gap-2 p-3 hover:bg-blue-50 rounded-lg transition-colors text-left"
                        >
                          {isTituloExpanded ? (
                            <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{tituloData.titulo}</p>
                            <p className="text-xs text-gray-500">
                              {Object.values(tituloData.capitulos).reduce(
                                (sum, cap) => sum + cap.artigos.length,
                                0
                              )}{' '}
                              artigos
                            </p>
                          </div>
                        </button>

                        {/* CAPÍTULOS */}
                        {isTituloExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            {Object.entries(tituloData.capitulos).map(([capituloKey, capituloData]) => {
                              const capituloId = `${tituloKey}::${capituloKey}`;
                              const isCapituloExpanded = expandedCapitulos.has(capituloId);

                              return (
                                <div key={capituloKey}>
                                  {/* CAPÍTULO */}
                                  <button
                                    onClick={() => toggleCapitulo(tituloKey, capituloKey)}
                                    className="w-full flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg transition-colors text-left"
                                  >
                                    {isCapituloExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">
                                        {capituloData.capituloCompleto}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {capituloData.artigos.length} artigos
                                      </p>
                                    </div>
                                  </button>

                                  {/* ARTIGOS */}
                                  {isCapituloExpanded && (
                                    <div className="ml-4 mt-1 space-y-1">
                                      {capituloData.artigos.map((article) => {
                                        const status = getArticleStatus(article.documentCount);
                                        const StatusIcon = status.icon;
                                        const isSelected = selectedArticle?.numero === article.numero;

                                        return (
                                          <button
                                            key={article.numero}
                                            ref={(el) => {
                                              articleRefs.current[article.numero] = el;
                                            }}
                                            onClick={() => handleSelectArticle(article)}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                                              isSelected
                                                ? 'bg-blue-100 border-2 border-blue-500'
                                                : 'hover:bg-gray-100'
                                            }`}
                                          >
                                            <span
                                              className={`px-2 py-1 rounded text-xs font-bold ${
                                                isSelected
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-gray-200 text-gray-700'
                                              }`}
                                            >
                                              Art. {article.numero}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-gray-700 truncate">
                                                {article.ementa.substring(0, 40)}...
                                              </p>
                                            </div>
                                            {article.documentCount > 0 && (
                                              <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                                {article.documentCount}
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Main Content - Artigo Selecionado + Documentos */}
          <div className="lg:col-span-8">
            {selectedArticle ? (
              <div className="space-y-6">
                {/* Artigo Card */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
                          Artigo {selectedArticle.numero}
                        </span>
                        {(() => {
                          const status = getArticleStatus(selectedArticle.documentCount);
                          const StatusIcon = status.icon;
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                      {selectedArticle.titulo && (
                        <p className="text-sm text-gray-600 mb-1">{selectedArticle.titulo}</p>
                      )}
                      {selectedArticle.capituloCompleto && (
                        <p className="text-sm text-gray-600 mb-2">{selectedArticle.capituloCompleto}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{selectedArticle.documentCount}</p>
                      <p className="text-sm text-gray-600">documentos</p>
                    </div>
                  </div>

                  <div className="prose max-w-none">
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedArticle.ementa}</p>
                  </div>
                </div>

                {/* Documentos */}
                {selectedArticle.documentCount > 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Documentos Relacionados ({selectedArticle.documentCount})
                    </h3>
                    <div className="space-y-3">
                      {selectedArticle.documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => handleDocumentClick(doc.id)}
                          className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-left border border-gray-200 hover:border-blue-300"
                        >
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <span className="flex-1 text-gray-900 font-medium">{doc.title}</span>
                          {doc.isPublic && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              Público
                            </span>
                          )}
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                    <p className="text-amber-900 font-medium mb-2">
                      Nenhum documento catalogado para este artigo
                    </p>
                    <p className="text-sm text-amber-700">
                      Este artigo ainda não possui documentos vinculados. Estamos trabalhando para ampliar a cobertura da lei.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Selecione um artigo</p>
                <p className="text-gray-500 text-sm">
                  Navegue pela estrutura da lei ao lado e selecione um artigo para ver seus documentos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Modal */}
      {isModalOpen && selectedDocumentId && (
        <DocumentDetailModal
          documentId={selectedDocumentId}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDocumentId(null);
          }}
          isFavorite={isFavorite(selectedDocumentId)}
          onToggleFavorite={() => toggleFavorite(selectedDocumentId)}
        />
      )}
    </div>
  );
}

// Wrapper com Suspense boundary (requerido pelo Next.js 15 para useSearchParams)
export default function LeiComentadaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando Lei 14.133/2021...</p>
          </div>
        </div>
      }
    >
      <LeiComentadaContent />
    </Suspense>
  );
}
