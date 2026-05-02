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
  Lightbulb,
  Heart,
  ArrowLeft,
  History,
  Sparkles,
  X,
  MessageSquareQuote
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useLegislativeActFavorites } from '@/hooks/use-legislative-act-favorites';
import { safeParseArray, normalizeTextContent } from '@/lib/utils';
import { isLiteralSourceCategory } from '@/lib/literal-sources';
import Link from 'next/link';
import { CROSS_REFERENCES } from '@/data/lei-14133-cross-references';
import { Star } from 'lucide-react';

interface EnunciadoResumo {
  id: string;
  orgao: 'INCP' | 'CJF' | 'IBDA';
  numero: number;
  texto: string;
  tema: string;
  url?: string;
}

interface EnrichedDoc {
  id: string;
  title: string;
  type: 'document' | 'legislativeAct';
  category: string | null;
  isPublic: boolean;
  url?: string;
  summary?: string | null;
  notesImportance?: string | null;
  hierarchyLevel?: number | null;
  esfera?: string | null;
  fullNumber?: string | null;
  leiArticlesCount: number;
  score: number;
  highlightReason: string;
}

interface ArticleDocsResponse {
  articleNumber: string;
  total: number;
  totalAll: number;
  highlights: EnrichedDoc[];
  byCategory: Record<string, EnrichedDoc[]>;
}

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
    type?: string; // 'document' ou 'legislativeAct'
  }[];
  enunciadoCount?: number;
  enunciados?: EnunciadoResumo[];
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

interface AISearchResult {
  articleNumber: string;
  title: string;
  ementa: string;
  capitulo: string;
  relevance: string;
  score: number;
}

interface AIDocumentResult {
  id: string;
  title: string;
  category: string;
  type: string;
  summary: string | null;
  linkedArticles: string[];
  relevance: string;
}

interface AIEnunciadoResult {
  id: string;
  orgao: string;
  numero: number;
  texto: string;
  tema: string;
  artigosVinculados: string[];
}

interface AISearchResponse {
  query: string;
  results: AISearchResult[];
  documents: AIDocumentResult[];
  enunciados: AIEnunciadoResult[];
  summary: string;
  isAISearch: boolean;
  cached: boolean;
  latency: number;
}

interface DocumentNotes {
  adminNotes?: string | null;
  publicNotes?: string | null;
  importance?: string | null;
  practicalUse?: string | null;
  keyPoints?: string | null;
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
  notesKeyPoints?: string | null;
  notesPracticalUse?: string | null;
  notesImportance?: string | null;
  notes?: DocumentNotes | null;
}

// Componente para mostrar detalhes do documento em accordion
function DocumentDetails({ documentId, documentType = 'document' }: { documentId: string; documentType?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);

  // Usar hook correto dependendo do tipo
  const docFavorites = useFavorites();
  const actFavorites = useLegislativeActFavorites();

  const isLegislativeAct = documentType === 'legislativeAct';
  const isFavorite = isLegislativeAct ? actFavorites.isFavorite : docFavorites.isFavorite;
  const _toggleFavorite = isLegislativeAct ? actFavorites.toggleFavorite : docFavorites.toggleFavorite;

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Determinar qual API chamar baseado no tipo
        const apiUrl = documentType === 'legislativeAct'
          ? `/api/legislative-acts/${documentId}`
          : `/api/documents/${documentId}`;

        console.log(`[DocumentDetails] Buscando ${documentType}: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(documentType === 'legislativeAct' ? 'Ato normativo não encontrado' : 'Documento não encontrado');
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
  }, [documentId, documentType]);

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
  // Prefer satellite table values, fall back to flat fields
  const effectiveKeyPoints = document.notes?.keyPoints ?? document.keyPoints ?? document.notesKeyPoints;
  const effectivePracticalUse = document.notes?.practicalUse ?? document.practicalUse ?? document.notesPracticalUse;
  const effectivePublicNotes = document.notes?.publicNotes ?? document.publicNotes;
  const keyPoints = effectiveKeyPoints ? effectiveKeyPoints.split('\n').filter(p => p.trim()) : [];
  // Fontes literais (enunciados): texto-fonte sempre na íntegra, sem summary IA.
  // Outras: summary IA quando presente, description como fallback. Ver lib/literal-sources.ts.
  const isLiteral = isLiteralSourceCategory(document.category);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg border-t border-gray-200 space-y-4">
      {/* Texto-fonte (enunciados): exibido na íntegra */}
      {isLiteral && document.description && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm">Texto do Enunciado</h4>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{document.description}</p>
        </div>
      )}

      {/* Resumo IA (não-literais) */}
      {!isLiteral && document.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm">Resumo</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(document.summary).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Key Points (admin-authored em DocumentNotes.keyPoints) */}
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
      {effectivePracticalUse && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-green-600" />
            <h4 className="font-bold text-green-900 text-sm">Aplicação Prática</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(effectivePracticalUse).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Professor Notes */}
      {effectivePublicNotes && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-amber-900 text-sm">Observações do Prof. Barral</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(effectivePublicNotes).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed italic">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Descrição (não-literais): fallback quando não há summary IA */}
      {!isLiteral && document.description && !document.summary && (
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

      {/* Action Buttons */}
      <div className="pt-3 border-t border-gray-200 flex gap-2">
        {/* Botão de Favoritar */}
        <button
          onClick={() => {
            if (isLegislativeAct) {
              actFavorites.toggleFavorite(documentId);
            } else {
              docFavorites.toggleFavorite(documentId, document?.courseId || '');
            }
          }}
          className={`px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
            isFavorite(documentId)
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          aria-label={isFavorite(documentId) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className={`w-5 h-5 ${isFavorite(documentId) ? 'fill-current' : ''}`} />
        </button>

        {/* Botão Principal */}
        {document.url && (document.type === 'link' || ['decreto', 'in', 'portaria', 'lei', 'medida-provisoria'].includes(document.type || '')) ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleView}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Acessar Documento Oficial
          </a>
        ) : document.url ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleView}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Acessar Link Externo
          </a>
        ) : (
          <a
            href={`/api/documents/${documentId}/download`}
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
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
  useAuth();
  useFavorites();

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

  // Documentos relacionados ao artigo selecionado (highlights + agrupamento)
  const [relatedDocs, setRelatedDocs] = useState<ArticleDocsResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Mobile drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Estados para busca com IA
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<AISearchResponse | null>(null);
  const [showAIResults, setShowAIResults] = useState(false);

  // Refs para scroll automático
  const articleRefs = useRef<Record<string, HTMLElement | null>>({});

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

  // 2.1 Buscar documentos relacionados (com highlights) quando artigo muda
  useEffect(() => {
    if (!selectedArticle) {
      setRelatedDocs(null);
      return;
    }
    let aborted = false;
    setLoadingDocs(true);
    fetch(`/api/lei-14133/article-docs/${selectedArticle.numero}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ArticleDocsResponse | null) => {
        if (!aborted) setRelatedDocs(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!aborted) setLoadingDocs(false);
      });
    return () => {
      aborted = true;
    };
  }, [selectedArticle]);

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
    setMobileDrawerOpen(false);

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

  const renderSidebarContent = () => (
    <div className="p-2">
      {filteredHierarchy &&
        Object.entries(filteredHierarchy).map(([tituloKey, tituloData]) => {
          const isTituloExpanded = expandedTitulos.has(tituloKey);

          return (
            <div key={tituloKey} className="mb-2">
              {/* TITULO */}
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

              {/* CAPITULOS */}
              {isTituloExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {Object.entries(tituloData.capitulos).map(([capituloKey, capituloData]) => {
                    const capituloId = `${tituloKey}::${capituloKey}`;
                    const isCapituloExpanded = expandedCapitulos.has(capituloId);

                    return (
                      <div key={capituloKey}>
                        {/* CAPITULO */}
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
  );

  const getArticleStatus = (count: number) => {
    if (count === 0) return { label: 'Órfão', color: 'bg-red-100 text-red-700', icon: AlertCircle };
    if (count < 3) return { label: 'Escasso', color: 'bg-orange-100 text-orange-700', icon: TrendingUp };
    if (count < 6) return { label: 'Médio', color: 'bg-blue-100 text-blue-700', icon: Target };
    if (count < 15) return { label: 'Bom', color: 'bg-green-100 text-green-700', icon: CheckCircle };
    return { label: 'Excelente', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
  };

  // Função de busca com IA
  const handleAISearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      return;
    }

    setIsAISearching(true);
    setShowAIResults(true);

    try {
      const response = await fetch('/api/lei-14133/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      if (!response.ok) {
        throw new Error('Erro na busca com IA');
      }

      const data: AISearchResponse = await response.json();
      setAiSearchResults(data);
    } catch (err) {
      console.error('[Busca IA] Erro:', err);
      setAiSearchResults(null);
    } finally {
      setIsAISearching(false);
    }
  };

  // Navegar para artigo a partir da busca IA
  const handleAIResultClick = (articleNumber: string) => {
    const article = apiData?.articles.find(a => a.numero === articleNumber);
    if (article) {
      handleSelectArticle(article);
      setShowAIResults(false);

      // Expandir título e capítulo
      if (article.titulo) {
        setExpandedTitulos(prev => new Set([...prev, article.titulo!]));
      }
      const capituloKey = `${article.titulo}::${article.capitulo}`;
      setExpandedCapitulos(prev => new Set([...prev, capituloKey]));

      // Scroll para o artigo
      setTimeout(() => {
        const ref = articleRefs.current[articleNumber];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
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
          {/* Navegação Superior */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/area-restrita"
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Área Restrita</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/area-restrita/historico-ia"
                className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
              >
                <History className="w-5 h-5" />
                <span className="hidden sm:inline">Histórico</span>
              </Link>
              <Link
                href="/area-restrita/favoritos"
                className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
              >
                <Heart className="w-5 h-5" />
                <span className="hidden sm:inline">Favoritos</span>
              </Link>
            </div>
          </div>

          {/* Título */}
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
                placeholder="Pergunte algo como: 'Quando usar dispensa de licitação?' ou busque por artigo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim().length >= 3) {
                    handleAISearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleAISearch}
              disabled={isAISearching || searchQuery.trim().length < 3}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                isAISearching
                  ? 'bg-purple-400 text-white cursor-wait'
                  : searchQuery.trim().length < 3
                  ? 'bg-purple-300 text-white cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              title="Busca inteligente com IA"
            >
              {isAISearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">{isAISearching ? 'Buscando...' : 'Buscar com IA'}</span>
            </button>
            <button
              onClick={() => setOnlyWithDocuments(!onlyWithDocuments)}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                onlyWithDocuments
                  ? 'bg-white text-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">{onlyWithDocuments ? 'Mostrar Todos' : 'Apenas com Docs'}</span>
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

      {/* Modal de Resultados da Busca com IA */}
      {showAIResults && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-lg">Busca Inteligente</h3>
                  <p className="text-sm text-purple-200">
                    {aiSearchResults?.query ? `"${aiSearchResults.query}"` : 'Processando...'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAIResults(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-4">
              {isAISearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
                  <p className="text-gray-600">Analisando sua pergunta com IA...</p>
                  <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns segundos</p>
                </div>
              ) : aiSearchResults ? (
                <div className="space-y-4">
                  {/* Resumo da IA */}
                  {aiSearchResults.summary && (
                    <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <h4 className="font-bold text-purple-900 text-sm">Resumo</h4>
                      </div>
                      <p className="text-gray-800 text-sm">{aiSearchResults.summary}</p>
                    </div>
                  )}

                  {/* Meta informações */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{aiSearchResults.results.length} artigo(s) encontrado(s)</span>
                    <span>{aiSearchResults.latency}ms</span>
                    {aiSearchResults.cached && (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">cache</span>
                    )}
                  </div>

                  {/* Resultados - Artigos */}
                  {aiSearchResults.results.length > 0 && (
                    <>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <Scale className="w-4 h-4 text-blue-600" />
                        Artigos Relevantes ({aiSearchResults.results.length})
                      </h4>
                      <div className="space-y-3">
                        {aiSearchResults.results.map((result, index) => (
                          <button
                            key={result.articleNumber}
                            onClick={() => handleAIResultClick(result.articleNumber)}
                            className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-3">
                              {/* Ranking */}
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                {/* Artigo e Score */}
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-blue-600">Art. {result.articleNumber}</span>
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    {result.score}% relevante
                                  </span>
                                </div>
                                {/* Capítulo */}
                                <p className="text-xs text-gray-500 mb-2">{result.title}</p>
                                {/* Relevância */}
                                <div className="bg-gray-50 rounded p-2 mb-2">
                                  <p className="text-sm text-gray-700">{result.relevance}</p>
                                </div>
                                {/* Ementa resumida */}
                                <p className="text-xs text-gray-600 line-clamp-2">{result.ementa}</p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Resultados - Documentos */}
                  {aiSearchResults.documents && aiSearchResults.documents.length > 0 && (
                    <>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mt-6">
                        <FileText className="w-4 h-4 text-green-600" />
                        Documentos Relacionados ({aiSearchResults.documents.length})
                      </h4>
                      <div className="space-y-2">
                        {aiSearchResults.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.type === 'legislativeAct' ? `/api/legislative-acts/${doc.id}` : `/api/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-green-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900 text-sm truncate">{doc.title}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                    {doc.category}
                                  </span>
                                  <span className="text-xs text-gray-500">{doc.relevance}</span>
                                </div>
                                {/* Resumo IA: bloqueado para fontes literais (enunciados). Ver lib/literal-sources.ts. */}
                                {!isLiteralSourceCategory(doc.category) && doc.summary && (
                                  <p className="text-xs text-gray-600 line-clamp-2">{doc.summary}</p>
                                )}
                              </div>
                              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Resultados - Enunciados */}
                  {aiSearchResults.enunciados && aiSearchResults.enunciados.length > 0 && (
                    <>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mt-6">
                        <MessageSquareQuote className="w-4 h-4 text-purple-600" />
                        Enunciados Interpretativos ({aiSearchResults.enunciados.length})
                      </h4>
                      <div className="space-y-2">
                        {aiSearchResults.enunciados.map((enunciado) => (
                          <div
                            key={enunciado.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-purple-300 transition-all"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center">
                                <MessageSquareQuote className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded">
                                    {enunciado.orgao} {enunciado.numero}
                                  </span>
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                    {enunciado.tema}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 line-clamp-3">{enunciado.texto}</p>
                                {enunciado.artigosVinculados.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {enunciado.artigosVinculados.slice(0, 5).map(art => (
                                      <span key={art} className="text-xs text-blue-600">Art. {art}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Nenhum resultado */}
                  {aiSearchResults.results.length === 0 &&
                   (!aiSearchResults.documents || aiSearchResults.documents.length === 0) &&
                   (!aiSearchResults.enunciados || aiSearchResults.enunciados.length === 0) && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">Nenhum artigo, documento ou enunciado encontrado para sua busca.</p>
                      <p className="text-sm text-gray-500 mt-2">Tente reformular sua pergunta.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-gray-600">Erro ao processar sua busca.</p>
                  <p className="text-sm text-gray-500 mt-2">Por favor, tente novamente.</p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Busca semântica powered by Gemini AI • Clique em um artigo para navegar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Estrutura da Lei (hidden on mobile, shown via drawer) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
                <p className="text-sm text-gray-600">
                  {Object.keys(filteredHierarchy || {}).length} títulos
                </p>
              </div>
              {renderSidebarContent()}
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
                    <div className="space-y-2">
                      {normalizeTextContent(selectedArticle.ementa).map((p, i) => (
                        <p key={i} className="text-gray-800">{p}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cross-references */}
                {(() => {
                  const relatedTopics = CROSS_REFERENCES.filter(ref =>
                    ref.articles.includes(selectedArticle.numero)
                  );
                  if (relatedTopics.length === 0) return null;
                  return (
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-indigo-600" />
                        Artigos Relacionados
                      </h3>
                      <div className="space-y-4">
                        {relatedTopics.map(topic => (
                          <div key={topic.topic}>
                            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-2">
                              {topic.topic}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {topic.articles
                                .filter(a => a !== selectedArticle.numero)
                                .map(artNum => (
                                  <button
                                    key={artNum}
                                    onClick={() => {
                                      const art = apiData?.articles.find(a => a.numero === artNum);
                                      if (art) handleSelectArticle(art);
                                    }}
                                    className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                                  >
                                    Art. {artNum}
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Documentos: Destaques + lista por categoria (via /api/lei-14133/article-docs) */}
                {selectedArticle.documentCount > 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    {loadingDocs && !relatedDocs ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : relatedDocs ? (
                      <>
                        {/* Destaques */}
                        {relatedDocs.highlights.length > 0 && (
                          <section className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                              <h3 className="text-lg font-bold text-gray-900">
                                Regulamentações em destaque
                              </h3>
                              <span className="text-sm text-gray-500">
                                ({relatedDocs.highlights.length} de {relatedDocs.total})
                              </span>
                            </div>
                            <div className="space-y-3">
                              {relatedDocs.highlights.map((doc) => {
                                const tierLabel = (() => {
                                  if (doc.type === 'legislativeAct' && doc.hierarchyLevel) {
                                    const map: Record<number, string> = {
                                      1: 'Lei', 2: 'Decreto', 3: 'Portaria', 4: 'IN', 5: 'OS',
                                    };
                                    return map[doc.hierarchyLevel] || doc.category || 'Documento';
                                  }
                                  return doc.category || 'Documento';
                                })();
                                const isLei = doc.category === 'lei' || doc.category === 'medida-provisoria';
                                const isDecreto = doc.category === 'decreto';
                                const accent = isLei
                                  ? 'border-purple-300 bg-purple-50/40'
                                  : isDecreto
                                  ? 'border-blue-300 bg-blue-50/40'
                                  : 'border-amber-300 bg-amber-50/40';
                                return (
                                  <a
                                    key={doc.id}
                                    href={
                                      doc.url ||
                                      (doc.type === 'legislativeAct'
                                        ? `/atos-normativos/${doc.id}`
                                        : `/api/documents/${doc.id}/download`)
                                    }
                                    target={doc.url ? '_blank' : undefined}
                                    rel={doc.url ? 'noopener noreferrer' : undefined}
                                    className={`block border-2 ${accent} rounded-xl p-4 hover:shadow-md transition-all group`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className="px-2 py-0.5 bg-white border border-gray-300 text-gray-700 text-[11px] font-bold uppercase rounded tracking-wide">
                                            {tierLabel}
                                          </span>
                                          {doc.notesImportance === 'critica' && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[11px] font-bold uppercase rounded">Crítico</span>
                                          )}
                                          {doc.notesImportance === 'alta' && (
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold uppercase rounded">Destaque</span>
                                          )}
                                          {doc.esfera === 'federal' && doc.type === 'legislativeAct' && (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded">Federal</span>
                                          )}
                                        </div>
                                        <h4 className="font-semibold text-gray-900 text-base leading-snug mb-1 group-hover:text-blue-700 transition-colors">
                                          {doc.title}
                                        </h4>
                                        {doc.summary && (
                                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-2">{doc.summary}</p>
                                        )}
                                        <p className="text-xs text-gray-500 italic">{doc.highlightReason}</p>
                                      </div>
                                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1 group-hover:text-blue-600 transition-colors" />
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </section>
                        )}

                        {/* Lista completa por categoria */}
                        <section>
                          <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-500" />
                            Todos os documentos relacionados ({relatedDocs.total})
                          </h3>
                          <div className="space-y-2">
                            {Object.entries(relatedDocs.byCategory).map(([displayName, docs]) => {
                              const isCategoryExpanded = expandedCategories.has(displayName);
                              return (
                                <div key={displayName} className="border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => toggleCategoryExpanded(displayName)}
                                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                  >
                                    {isCategoryExpanded ? (
                                      <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    )}
                                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                    <h4 className="flex-1 font-semibold text-gray-900 text-sm">{displayName}</h4>
                                    <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{docs.length}</span>
                                  </button>

                                  {isCategoryExpanded && (
                                    <div className="bg-white border-t border-gray-200 p-3 space-y-2">
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
                                            {isDocExpanded && (
                                              <DocumentDetails documentId={doc.id} documentType={doc.type} />
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
                        </section>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Não foi possível carregar os documentos relacionados.
                      </p>
                    )}
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

                {/* Enunciados Interpretativos */}
                {selectedArticle.enunciados && selectedArticle.enunciados.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageSquareQuote className="w-5 h-5 text-purple-600" />
                      Enunciados Interpretativos ({selectedArticle.enunciados.length})
                    </h3>
                    <div className="space-y-3">
                      {selectedArticle.enunciados.map((enunciado) => {
                        const cardContent = (
                          <>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                                {enunciado.orgao} {enunciado.numero}
                              </span>
                              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                {enunciado.tema}
                              </span>
                              {enunciado.url && (
                                <ExternalLink className="w-3.5 h-3.5 text-purple-600 ml-auto" aria-hidden="true" />
                              )}
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed">{enunciado.texto}</p>
                          </>
                        );
                        return enunciado.url ? (
                          <a
                            key={enunciado.id}
                            href={enunciado.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg hover:bg-purple-100 transition-colors"
                          >
                            {cardContent}
                          </a>
                        ) : (
                          <div
                            key={enunciado.id}
                            className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg"
                          >
                            {cardContent}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Enunciados interpretativos aprovados pelos institutos especializados
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

      {/* Mobile FAB */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
        aria-label="Abrir navegação"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer */}
          <div
            className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-white shadow-2xl overflow-y-auto"
            style={{ animation: 'slide-in-left 0.2s ease-out' }}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
              <button onClick={() => setMobileDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
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
