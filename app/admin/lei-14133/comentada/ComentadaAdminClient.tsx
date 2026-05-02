'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Search, X } from 'lucide-react';
import {
  LeiSidebar,
  type LeiHierarchy,
  type LeiHierarchyTitulo,
  type LeiHierarchyCapitulo,
  type LeiArticleListItem,
} from '@/components/lei-14133/LeiSidebar';
import { ArticleEditorMain } from './ArticleEditorMain';

interface LeiArticle {
  id: string;
  numero: string;
  titulo: string | null;
  capituloCompleto: string | null;
  ementa: string;
  capitulo: string;
  secao: string | null;
  documentCount: number;
}

interface ApiResponse {
  articles: LeiArticle[];
  hierarchy: LeiHierarchy;
  total: number;
  totalWithDocuments: number;
}

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<LeiArticle | null>(null);
  const [expandedTitulos, setExpandedTitulos] = useState<Set<string>>(new Set());
  const [expandedCapitulos, setExpandedCapitulos] = useState<Set<string>>(new Set());

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
        if (article.titulo) setExpandedTitulos((prev) => new Set([...prev, article.titulo!]));
        const key = `${article.titulo}::${article.capitulo}`;
        setExpandedCapitulos((prev) => new Set([...prev, key]));
      }
    }
  }, [searchParams, apiData, loading]);

  const filteredHierarchy = useMemo<LeiHierarchy | null>(() => {
    if (!apiData) return null;
    if (!searchQuery) return apiData.hierarchy;
    const filtered: Record<string, LeiHierarchyTitulo> = {};
    Object.entries(apiData.hierarchy).forEach(([tk, td]) => {
      const fc: Record<string, LeiHierarchyCapitulo> = {};
      Object.entries(td.capitulos).forEach(([ck, cd]) => {
        const fa = cd.artigos.filter((art) => {
          const q = searchQuery.toLowerCase();
          return art.numero.includes(q) || art.ementa.toLowerCase().includes(q);
        });
        if (fa.length > 0) fc[ck] = { ...cd, artigos: fa };
      });
      if (Object.keys(fc).length > 0) filtered[tk] = { ...td, capitulos: fc };
    });
    return filtered;
  }, [apiData, searchQuery]);

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

  const handleSelectArticle = (art: LeiArticle) => {
    setSelectedArticle(art);
    setMobileDrawerOpen(false);
    router.push(`/admin/lei-14133/comentada?artigo=${art.numero}`, { scroll: false });
  };

  // Wrapper so LeiSidebar's onSelectArticle (LeiArticleListItem) resolves to the full LeiArticle
  const handleSidebarSelect = (item: LeiArticleListItem) => {
    if (!apiData) return;
    const article = apiData.articles.find((a) => a.numero === item.numero);
    if (article) handleSelectArticle(article);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }
  if (error || !apiData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-700 text-center">{error || 'Erro desconhecido'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin" className="flex items-center gap-2 text-white/80 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <Link href="/lei-14133" className="bg-white/20 px-3 py-1.5 rounded-lg hover:bg-white/30 text-sm">
              Ver no site público →
            </Link>
          </div>

          <div className="mb-4">
            <h1 className="text-3xl font-bold">Lei 14.133 Comentada — Editor</h1>
            <p className="text-purple-100">Controle editorial completo: comentário, leituras, vinculações e destaques</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar artigo por número ou texto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Estrutura da Lei</h2>
                <p className="text-sm text-gray-600">{Object.keys(filteredHierarchy || {}).length} títulos</p>
              </div>
              <LeiSidebar
                hierarchy={filteredHierarchy}
                selectedNumero={selectedArticle?.numero || null}
                expandedTitulos={expandedTitulos}
                expandedCapitulos={expandedCapitulos}
                onToggleTitulo={toggleTitulo}
                onToggleCapitulo={toggleCapitulo}
                onSelectArticle={handleSidebarSelect}
                articleRefs={articleRefs as React.RefObject<Record<string, HTMLElement | null>>}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            {selectedArticle ? (
              <ArticleEditorMain numero={selectedArticle.numero} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Selecione um artigo</p>
                <p className="text-gray-500 text-sm">Escolha um artigo na sidebar para começar a editar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileDrawerOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-[80vw] max-w-sm bg-white shadow-2xl overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Estrutura</h2>
              <button onClick={() => setMobileDrawerOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <LeiSidebar
              hierarchy={filteredHierarchy}
              selectedNumero={selectedArticle?.numero || null}
              expandedTitulos={expandedTitulos}
              expandedCapitulos={expandedCapitulos}
              onToggleTitulo={toggleTitulo}
              onToggleCapitulo={toggleCapitulo}
              onSelectArticle={handleSidebarSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComentadaAdminClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
