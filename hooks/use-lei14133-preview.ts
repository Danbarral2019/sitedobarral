'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export interface EnunciadoResumo {
  id: string;
  orgao: 'INCP' | 'CJF' | 'IBDA';
  numero: number;
  texto: string;
  tema: string;
  url?: string;
}

export interface CuratedCrossRef {
  id: string;
  targetNumber: string;
  note: string;
  order: number;
}

export interface SuggestedReading {
  id: string;
  kind: 'internal' | 'external';
  internalType?: string | null;
  internalId?: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  order: number;
}

export interface LeiArticle {
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
  // Campos opcionais usados pela /lei-14133 (publica) — preview nao consome
  professorComment?: string | null;
  commentUpdatedAt?: string | null;
  crossRefs?: CuratedCrossRef[];
  suggestedReadings?: SuggestedReading[];
}

export interface HierarchyCapitulo {
  capituloCompleto: string;
  artigos: LeiArticle[];
}

export interface HierarchyTitulo {
  titulo: string;
  capitulos: Record<string, HierarchyCapitulo>;
}

export interface ApiResponse {
  articles: LeiArticle[];
  hierarchy: Record<string, HierarchyTitulo>;
  total: number;
  totalWithDocuments: number;
}

export interface EnrichedDoc {
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
  /** O documento cita o artigo textualmente, ou só se relaciona por tema? */
  citesArticle: boolean;
  /** O artigo foi razão de decidir no voto do acórdão (só acórdãos). */
  debatedInVoto?: boolean;
}

export interface ArticleDocsResponse {
  articleNumber: string;
  /** Documentos que CITAM o artigo (o que vai nos accordions). */
  total: number;
  totalCited: number;
  /** Acórdãos em que o artigo foi razão de decidir no voto — exibidos no topo. */
  totalDebated: number;
  /** Vinculados só por tema pelo LLM — exibidos à parte, sem se passarem por citação. */
  totalRelated: number;
  /** Tier "debatido no voto" — o sinal mais forte da jurisprudência. */
  debatedInVoto: EnrichedDoc[];
  highlights: EnrichedDoc[];
  byCategory: Record<string, EnrichedDoc[]>;
  relatedByTheme: EnrichedDoc[];
}

export function useLei14133Preview(basePath: string = '/lei-14133/preview') {
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

  const [relatedDocs, setRelatedDocs] = useState<ArticleDocsResponse | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const articleRefs = useRef<Record<string, HTMLElement | null>>({});

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

  useEffect(() => {
    if (apiData && !loading && !selectedArticle && !searchParams?.get('artigo')) {
      const firstWithDocs = apiData.articles.find((a) => a.documentCount > 0) || apiData.articles[0];
      if (firstWithDocs) setSelectedArticle(firstWithDocs);
    }
  }, [apiData, loading, selectedArticle, searchParams]);

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

  const toggleTitulo = useCallback((t: string) => {
    setExpandedTitulos((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });
  }, []);

  const toggleCapitulo = useCallback((tk: string, ck: string) => {
    const key = `${tk}::${ck}`;
    setExpandedCapitulos((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  }, []);

  const toggleCategory = useCallback((name: string) => {
    setExpandedCategories((prev) => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name);
      else s.add(name);
      return s;
    });
  }, []);

  const selectArticle = useCallback(
    (article: LeiArticle) => {
      setSelectedArticle(article);
      setMobileDrawerOpen(false);
      router.push(`${basePath}?artigo=${article.numero}`, { scroll: false });
    },
    [router, basePath],
  );

  const toggleOnlyWithDocs = useCallback(() => {
    setOnlyWithDocuments((prev) => !prev);
  }, []);

  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);
  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  return {
    // Data
    loading,
    error,
    apiData,
    selectedArticle,
    relatedDocs,
    loadingDocs,
    filteredHierarchy,

    // Search/filter
    searchQuery,
    setSearchQuery,
    onlyWithDocuments,
    toggleOnlyWithDocs,

    // Sidebar expansion
    expandedTitulos,
    expandedCapitulos,
    toggleTitulo,
    toggleCapitulo,
    articleRefs,

    // Documents expansion
    expandedCategories,
    toggleCategory,

    // Article selection
    selectArticle,

    // Mobile drawer
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
  };
}
