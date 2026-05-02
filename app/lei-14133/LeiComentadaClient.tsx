'use client';

/**
 * Cliente da Lei 14.133 Comentada — apresentação pública.
 *
 * Sidebar (Estrutura da Lei) + main column (artigo selecionado).
 * Documentos: Top 5 destaques + lista por categoria (accordion).
 * Score combina hierarquia normativa, LegislativeAct.importance e
 * especificidade. Enunciados clicáveis (CJF/IBDA/INCP).
 *
 * A versão logada (/area-restrita/lei-comentada) tem a mesma estrutura
 * mas inclui Favoritos/Histórico e botão de favoritar nos docs.
 */

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  ArrowLeft,
  Sparkles,
  X,
  ExternalLink,
  Star,
  MessageSquareQuote,
} from 'lucide-react';
import { CROSS_REFERENCES } from '@/data/lei-14133-cross-references';
import { normalizeTextContent } from '@/lib/utils';

interface EnunciadoResumo {
  id: string;
  orgao: 'INCP' | 'CJF' | 'IBDA';
  numero: number;
  texto: string;
  tema: string;
  url?: string;
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
  documents: { id: string; title: string; isPublic: boolean; category: string | null; type?: string }[];
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

interface EnrichedDoc {
  id: string;
  title: string;
  type: 'document' | 'legislativeAct';
  category: string | null;
  isPublic: boolean;
  url?: string;
  summary?: string | null;
  ementa?: string | null;
  notesImportance?: string | null;
  hierarchyLevel?: number | null;
  esfera?: string | null;
  fullNumber?: string | null;
  issuer?: string | null;
  leiArticlesCount: number;
  score: number;
  highlightReason: string;
}

interface ArticleDocsResponse {
  articleNumber: string;
  total: number;
  highlights: EnrichedDoc[];
  byCategory: Record<string, EnrichedDoc[]>;
}

function getArticleStatus(count: number) {
  if (count === 0) return { label: 'Sem documentos', color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
  if (count < 3) return { label: 'Inicial', color: 'bg-orange-100 text-orange-700', icon: TrendingUp };
  if (count < 6) return { label: 'Médio', color: 'bg-blue-100 text-blue-700', icon: Target };
  if (count < 15) return { label: 'Bom', color: 'bg-green-100 text-green-700', icon: CheckCircle };
  return { label: 'Excelente', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
}

function HighlightCard({ doc }: { doc: EnrichedDoc }) {
  const isLei = doc.category === 'lei' || doc.category === 'medida-provisoria';
  const isDecreto = doc.category === 'decreto';
  const tierLabel = (() => {
    if (doc.type === 'legislativeAct' && doc.hierarchyLevel) {
      const map: Record<number, string> = { 1: 'Lei', 2: 'Decreto', 3: 'Portaria', 4: 'IN', 5: 'OS' };
      return map[doc.hierarchyLevel] || doc.category;
    }
    return doc.category || 'Documento';
  })();

  const accent = isLei
    ? 'border-purple-300 bg-purple-50/40'
    : isDecreto
    ? 'border-blue-300 bg-blue-50/40'
    : 'border-amber-300 bg-amber-50/40';

  return (
    <a
      href={doc.url || (doc.type === 'legislativeAct' ? `/atos-normativos/${doc.id}` : `/api/documents/${doc.id}/download`)}
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
}

function CategoryAccordion({
  displayName,
  docs,
  expanded,
  onToggle,
}: {
  displayName: string;
  docs: EnrichedDoc[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm">{displayName}</h4>
        </div>
        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{docs.length}</span>
      </button>

      {expanded && (
        <ul className="bg-white divide-y divide-gray-100">
          {docs.map((doc) => (
            <li key={doc.id}>
              <a
                href={doc.url || (doc.type === 'legislativeAct' ? `/atos-normativos/${doc.id}` : `/api/documents/${doc.id}/download`)}
                target={doc.url ? '_blank' : undefined}
                rel={doc.url ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-800 line-clamp-1">{doc.title}</span>
                {doc.isPublic && (
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded">Público</span>
                )}
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeiComentadaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithDocuments, setOnlyWithDocuments] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<LeiArticle | null>(null);
  const [expandedTitulos, setExpandedTitulos] = useState<Set<string>>(new Set());
  const [expandedCapitulos, setExpandedCapitulos] = useState<Set<string>>(new Set());

  // Documentos relacionados (carregados quando artigo é selecionado)
  const [relatedDocs, setRelatedDocs] = useState<ArticleDocsResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const articleRefs = useRef<Record<string, HTMLElement | null>>({});

  // Carregar artigos
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/lei-14133/articles');
        if (!response.ok) throw new Error('Erro ao carregar artigos');
        const data: ApiResponse = await response.json();
        setApiData(data);
        const firstTitulo = Object.keys(data.hierarchy)[0];
        if (firstTitulo) {
          setExpandedTitulos(new Set([firstTitulo]));
          const firstCap = Object.keys(data.hierarchy[firstTitulo].capitulos)[0];
          if (firstCap) setExpandedCapitulos(new Set([`${firstTitulo}::${firstCap}`]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

  // Auto-scroll para artigo da URL
  useEffect(() => {
    const articleParam = searchParams?.get('artigo');
    if (articleParam && apiData && !loading) {
      const article = apiData.articles.find((a) => a.numero === articleParam);
      if (article) {
        setSelectedArticle(article);
        if (article.titulo) {
          setExpandedTitulos((prev) => new Set([...prev, article.titulo!]));
        }
        const key = `${article.titulo}::${article.capitulo}`;
        setExpandedCapitulos((prev) => new Set([...prev, key]));
        setTimeout(() => {
          const ref = articleRefs.current[article.numero];
          if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [searchParams, apiData, loading]);

  // Selecionar primeiro artigo automaticamente se nenhum na URL
  useEffect(() => {
    if (apiData && !loading && !selectedArticle && !searchParams?.get('artigo')) {
      const firstWithDocs = apiData.articles.find((a) => a.documentCount > 0) || apiData.articles[0];
      if (firstWithDocs) setSelectedArticle(firstWithDocs);
    }
  }, [apiData, loading, selectedArticle, searchParams]);

  // Buscar docs relacionados quando artigo muda
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

  const filteredHierarchy = useMemo(() => {
    if (!apiData) return null;
    if (!searchQuery && !onlyWithDocuments) return apiData.hierarchy;

    const filtered: Record<string, HierarchyTitulo> = {};
    Object.entries(apiData.hierarchy).forEach(([tk, td]) => {
      const fc: Record<string, HierarchyCapitulo> = {};
      Object.entries(td.capitulos).forEach(([ck, cd]) => {
        const fa = cd.artigos.filter((art) => {
          if (onlyWithDocuments && art.documentCount === 0) return false;
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
              art.numero.includes(q) ||
              art.ementa.toLowerCase().includes(q) ||
              (art.titulo && art.titulo.toLowerCase().includes(q))
            );
          }
          return true;
        });
        if (fa.length > 0) fc[ck] = { ...cd, artigos: fa };
      });
      if (Object.keys(fc).length > 0) filtered[tk] = { ...td, capitulos: fc };
    });
    return filtered;
  }, [apiData, searchQuery, onlyWithDocuments]);

  const toggleTitulo = (t: string) => {
    setExpandedTitulos((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });
  };

  const toggleCapitulo = (tk: string, ck: string) => {
    const key = `${tk}::${ck}`;
    setExpandedCapitulos((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const handleSelectArticle = (article: LeiArticle) => {
    setSelectedArticle(article);
    setMobileDrawerOpen(false);
    router.push(`/lei-14133?artigo=${article.numero}`, { scroll: false });
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name);
      else s.add(name);
      return s;
    });
  };

  const renderSidebar = () => (
    <div className="p-2">
      {filteredHierarchy &&
        Object.entries(filteredHierarchy).map(([tk, td]) => {
          const open = expandedTitulos.has(tk);
          return (
            <div key={tk} className="mb-2">
              <button
                onClick={() => toggleTitulo(tk)}
                className="w-full flex items-center gap-2 p-3 hover:bg-blue-50 rounded-lg transition-colors text-left"
              >
                {open ? (
                  <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{td.titulo}</p>
                  <p className="text-xs text-gray-500">
                    {Object.values(td.capitulos).reduce((sum, c) => sum + c.artigos.length, 0)} artigos
                  </p>
                </div>
              </button>

              {open && (
                <div className="ml-4 mt-1 space-y-1">
                  {Object.entries(td.capitulos).map(([ck, cd]) => {
                    const cId = `${tk}::${ck}`;
                    const cOpen = expandedCapitulos.has(cId);
                    return (
                      <div key={ck}>
                        <button
                          onClick={() => toggleCapitulo(tk, ck)}
                          className="w-full flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-lg transition-colors text-left"
                        >
                          {cOpen ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {cd.capituloCompleto}
                            </p>
                            <p className="text-xs text-gray-500">{cd.artigos.length} artigos</p>
                          </div>
                        </button>

                        {cOpen && (
                          <div className="ml-4 mt-1 space-y-1">
                            {cd.artigos.map((art) => {
                              const sel = selectedArticle?.numero === art.numero;
                              return (
                                <button
                                  key={art.numero}
                                  ref={(el) => {
                                    articleRefs.current[art.numero] = el;
                                  }}
                                  onClick={() => handleSelectArticle(art)}
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                                    sel ? 'bg-blue-100 border-2 border-blue-500' : 'hover:bg-gray-100'
                                  }`}
                                >
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-bold ${
                                      sel ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}
                                  >
                                    Art. {art.numero}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-700 truncate">
                                      {art.ementa.substring(0, 40)}…
                                    </p>
                                  </div>
                                  {art.documentCount > 0 && (
                                    <span className="flex-shrink-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                      {art.documentCount}
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando Lei 14.133/2021…</p>
        </div>
      </div>
    );
  }

  if (error || !apiData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 text-center mb-2">Erro ao carregar</h2>
          <p className="text-red-700 text-center mb-4">{error || 'Erro desconhecido'}</p>
        </div>
      </div>
    );
  }

  const relatedTopics = selectedArticle
    ? CROSS_REFERENCES.filter((r) => r.articles.includes(selectedArticle.numero))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Início</span>
            </Link>
            <Link
              href="/area-restrita"
              className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors text-sm"
            >
              Área Restrita
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Lei 14.133/2021 Comentada</h1>
              <p className="text-blue-100">Nova Lei de Licitações e Contratos Administrativos</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pergunte algo como: 'Quando usar dispensa de licitação?' ou busque por artigo…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              disabled={searchQuery.trim().length < 3}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                searchQuery.trim().length < 3
                  ? 'bg-purple-300 text-white cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
              title="Busca semântica com IA"
            >
              <Sparkles className="w-5 h-5" />
              <span className="hidden sm:inline">Buscar com IA</span>
            </button>
            <button
              onClick={() => setOnlyWithDocuments(!onlyWithDocuments)}
              className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                onlyWithDocuments ? 'bg-white text-blue-700' : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">{onlyWithDocuments ? 'Mostrar todos' : 'Apenas com docs'}</span>
            </button>
          </div>

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
          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
                <p className="text-sm text-gray-600">{Object.keys(filteredHierarchy || {}).length} títulos</p>
              </div>
              {renderSidebar()}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8">
            {selectedArticle ? (
              <div className="space-y-6">
                {/* Card do artigo: meta + texto */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
                          Artigo {selectedArticle.numero}
                        </span>
                        {(() => {
                          const status = getArticleStatus(selectedArticle.documentCount);
                          const Icon = status.icon;
                          return (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} flex items-center gap-1`}
                            >
                              <Icon className="w-3 h-3" />
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
                    <div className="text-right flex-shrink-0">
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
                {relatedTopics.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Scale className="w-5 h-5 text-indigo-600" />
                      Artigos Relacionados
                    </h3>
                    <div className="space-y-4">
                      {relatedTopics.map((topic) => (
                        <div key={topic.topic}>
                          <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-2">
                            {topic.topic}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {topic.articles
                              .filter((a) => a !== selectedArticle.numero)
                              .map((artNum) => {
                                const art = apiData.articles.find((a) => a.numero === artNum);
                                if (!art) return null;
                                return (
                                  <button
                                    key={artNum}
                                    onClick={() => handleSelectArticle(art)}
                                    className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                                  >
                                    Art. {artNum}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentos: Destaques + lista por categoria */}
                {selectedArticle.documentCount > 0 && (
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
                              {relatedDocs.highlights.map((doc) => (
                                <HighlightCard key={doc.id} doc={doc} />
                              ))}
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
                            {Object.entries(relatedDocs.byCategory).map(([displayName, docs]) => (
                              <CategoryAccordion
                                key={displayName}
                                displayName={displayName}
                                docs={docs}
                                expanded={expandedCategories.has(displayName)}
                                onToggle={() => toggleCategory(displayName)}
                              />
                            ))}
                          </div>
                        </section>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Não foi possível carregar os documentos relacionados.
                      </p>
                    )}
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
                      {selectedArticle.enunciados.map((e) => {
                        const cardContent = (
                          <>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                                {e.orgao} {e.numero}
                              </span>
                              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                {e.tema}
                              </span>
                              {e.url && (
                                <ExternalLink className="w-3.5 h-3.5 text-purple-600 ml-auto" aria-hidden="true" />
                              )}
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed">{e.texto}</p>
                          </>
                        );
                        return e.url ? (
                          <a
                            key={e.id}
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg hover:bg-purple-100 transition-colors"
                          >
                            {cardContent}
                          </a>
                        ) : (
                          <div key={e.id} className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg">
                            {cardContent}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Selecione um artigo</p>
                <p className="text-gray-500 text-sm">
                  Navegue pela estrutura da lei ao lado e selecione um artigo
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
              <button onClick={() => setMobileDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebar()}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeiComentadaClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <LeiComentadaContent />
    </Suspense>
  );
}
