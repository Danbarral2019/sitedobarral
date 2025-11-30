'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  CheckCircle,
  Download,
  ExternalLink,
  Calendar,
  Tag,
  Lightbulb,
  Heart
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { safeParseArray } from '@/lib/utils';
import Link from 'next/link';
import ArticleChatInterface from '@/components/ArticleChatInterface';

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
    category: string | null;
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

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  uploadedAt: string;
  tags: string | null;
  leiArticles: string | null;
  courseId: string | null;
  summary: string | null;
  keyPoints: string | null;
  practicalUse: string | null;
  publicNotes: string | null;
  importance: string | null;
}

// Componente para mostrar detalhes do documento em accordion
function DocumentDetails({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Documento não encontrado');
        }

        const data = await response.json();
        setDocument(data);
      } catch (err) {
        console.error('[Document Details] Erro ao carregar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  const handleDownload = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'download',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  const handleView = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'view',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  if (loading) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg border-t border-gray-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-center text-gray-600 mt-3">Carregando detalhes...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border-t border-red-200">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-center text-red-700">{error || 'Documento não encontrado'}</p>
      </div>
    );
  }

  const tags = safeParseArray(document.tags);
  const leiArticles = safeParseArray(document.leiArticles);
  const keyPoints = document.keyPoints ? document.keyPoints.split('\n').filter(p => p.trim()) : [];

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg border-t border-gray-200 space-y-4">
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Tag className="w-3 h-3" />
            <span className="text-xs font-medium">Categoria</span>
          </div>
          <p className="font-bold text-gray-900 text-sm capitalize">{document.category}</p>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <FileText className="w-3 h-3" />
            <span className="text-xs font-medium">Tipo</span>
          </div>
          <p className="font-bold text-gray-900 text-sm uppercase">{document.type}</p>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Calendar className="w-3 h-3" />
            <span className="text-xs font-medium">Enviado</span>
          </div>
          <p className="font-bold text-gray-900 text-xs">
            {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="bg-white p-3 rounded-lg shadow-sm flex items-center justify-center">
          <button
            onClick={() => toggleFavorite(documentId)}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite(documentId) ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            aria-label={isFavorite(documentId) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Heart className={`w-4 h-4 ${isFavorite(documentId) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary */}
      {document.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm">Resumo</h4>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{document.summary}</p>
        </div>
      )}

      {/* Key Points */}
      {keyPoints.length > 0 && (
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-600" />
            <h4 className="font-bold text-purple-900 text-sm">Pontos-Chave</h4>
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <p className="text-gray-800">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Practical Use */}
      {document.practicalUse && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-green-600" />
            <h4 className="font-bold text-green-900 text-sm">Aplicação Prática</h4>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{document.practicalUse}</p>
        </div>
      )}

      {/* Professor Notes */}
      {document.publicNotes && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-amber-900 text-sm">Observações do Prof. Barral</h4>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed italic whitespace-pre-wrap">{document.publicNotes}</p>
        </div>
      )}

      {/* Description (fallback) */}
      {document.description && !document.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <h4 className="font-bold text-gray-900 text-sm mb-2">Descrição</h4>
          <p className="text-gray-800 text-sm leading-relaxed">{document.description}</p>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Linked Articles */}
      {leiArticles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-gray-900 text-sm">Artigos Relacionados</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {leiArticles.map((artNum) => (
              <Link
                key={artNum}
                href={`/area-restrita/lei-comentada?artigo=${artNum}`}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                Art. {artNum}
                <ChevronRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-3 border-t border-gray-200">
        {document.type === 'link' ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleView}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Acessar Link Externo
          </a>
        ) : (
          <a
            href={`/api/documents/${documentId}/download`}
            onClick={handleDownload}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download do Arquivo
          </a>
        )}
      </div>
    </div>
  );
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

  // Accordion de categorias de documentos
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Accordion de documentos individuais
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);

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

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleDocumentExpanded = (documentId: string) => {
    setExpandedDocumentId(prev => prev === documentId ? null : documentId);
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

                {/* Chat com IA */}
                <ArticleChatInterface
                  articleNumber={selectedArticle.numero}
                  articleTitle={selectedArticle.titulo || undefined}
                />

                {/* Documentos Agrupados por Categoria */}
                {selectedArticle.documentCount > 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Documentos Relacionados ({selectedArticle.documentCount})
                    </h3>
                    <div className="space-y-3">
                      {(() => {
                        // Mapear categorias brutas para nomes de exibição
                        const categoryDisplayNames: Record<string, string> = {
                          'lei': 'Leis',
                          'medida-provisoria': 'Leis',
                          'decreto': 'Decretos',
                          'portaria': 'Portarias',
                          'in': 'Instruções Normativas',
                          'orientacao-normativa': 'Pareceres da AGU',
                          'parecer-vinculante': 'Pareceres da AGU',
                          'decor': 'Pareceres da AGU',
                          'acordao': 'Jurisprudência dos Tribunais de Contas',
                          'outro': 'Outros Documentos',
                        };

                        // Agrupar documentos pelo NOME DE EXIBIÇÃO (consolidando categorias relacionadas)
                        const docsByDisplayName: Record<string, typeof selectedArticle.documents> = {};
                        selectedArticle.documents.forEach((doc) => {
                          const rawCategory = doc.category || 'outro';
                          const displayName = categoryDisplayNames[rawCategory] || rawCategory;
                          if (!docsByDisplayName[displayName]) {
                            docsByDisplayName[displayName] = [];
                          }
                          docsByDisplayName[displayName].push(doc);
                        });

                        // Ordem de exibição das categorias consolidadas
                        const displayOrder = [
                          'Leis',
                          'Decretos',
                          'Portarias',
                          'Instruções Normativas',
                          'Pareceres da AGU',
                          'Jurisprudência dos Tribunais de Contas',
                          'Outros Documentos',
                        ];

                        const sortedDisplayNames = Object.keys(docsByDisplayName).sort((a, b) => {
                          const indexA = displayOrder.indexOf(a);
                          const indexB = displayOrder.indexOf(b);
                          return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                        });

                        return sortedDisplayNames.map((displayName) => {
                          const docs = docsByDisplayName[displayName];
                          const isCategoryExpanded = expandedCategories.has(displayName);

                          return (
                            <div key={displayName} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                              {/* Header do Accordion de Categoria */}
                              <button
                                onClick={() => toggleCategoryExpanded(displayName)}
                                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-colors text-left"
                              >
                                {isCategoryExpanded ? (
                                  <ChevronDown className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                                )}
                                <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-bold text-gray-900">{displayName}</h4>
                                  <p className="text-xs text-gray-600">{docs.length} {docs.length === 1 ? 'documento' : 'documentos'}</p>
                                </div>
                                <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-bold">
                                  {docs.length}
                                </div>
                              </button>

                              {/* Lista de Documentos da Categoria */}
                              {isCategoryExpanded && (
                                <div className="bg-white border-t-2 border-gray-200">
                                  <div className="p-3 space-y-2">
                                    {docs.map((doc) => {
                                      const isDocExpanded = expandedDocumentId === doc.id;
                                      return (
                                        <div key={doc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                          <button
                                            onClick={() => toggleDocumentExpanded(doc.id)}
                                            className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 transition-colors text-left"
                                          >
                                            {isDocExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                            )}
                                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                            <span className="flex-1 text-gray-900 text-sm font-medium line-clamp-1">{doc.title}</span>
                                            {doc.isPublic && (
                                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                                Público
                                              </span>
                                            )}
                                          </button>

                                          {isDocExpanded && <DocumentDetails documentId={doc.id} />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
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
