'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, BookOpen, ArrowRight, FileText, X, List, Hash } from 'lucide-react';
import type { LeiArticle } from '@/data/lei-14133-artigos';
import { LEI_14133_GRUPOS, getGroupById } from '@/data/lei-14133-grupos';
import { formatArticleNumber } from '@/lib/article-utils';

type NavigationMode = 'articles' | 'groups';

// Função de busca que funciona com o estado de artigos
function searchArticles(artigos: Record<string, LeiArticle>, searchTerm: string) {
  const allArticles = Object.values(artigos);
  const term = searchTerm.toLowerCase();

  return allArticles
    .filter(article =>
      article.numero.toLowerCase().includes(term) ||
      article.ementa.toLowerCase().includes(term) ||
      article.titulo?.toLowerCase().includes(term) ||
      article.capitulo.toLowerCase().includes(term) ||
      article.secao?.toLowerCase().includes(term)
    )
    .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
    .slice(0, 50); // Limita a 50 resultados
}

export default function ArtigosIndexPage() {
  const [artigos, setArtigos] = useState<Record<string, LeiArticle>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<NavigationMode>('articles');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [articleSearch, setArticleSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Buscar artigos do banco. Fallback estático carrega dinamicamente apenas se a API falhar
  // (caso contrário pesaria 329 KB no bundle inicial).
  useEffect(() => {
    async function fetchArtigos() {
      try {
        const response = await fetch('/api/lei-14133/artigos');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success || !data.artigos) throw new Error('payload inválido');
        setArtigos(data.artigos);
        setFetchError(null);
      } catch (error) {
        console.error('Erro ao buscar artigos, carregando fallback estático:', error);
        const { LEI_14133_ARTIGOS } = await import('@/data/lei-14133-artigos');
        setArtigos(LEI_14133_ARTIGOS);
        setFetchError('Não foi possível carregar os artigos do servidor. Exibindo dados locais.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchArtigos();
  }, []);

  // Busca de artigos (global - no topo)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchArticles(artigos, searchTerm);
  }, [searchTerm, artigos]);

  // Lista filtrada de artigos (na aba Artigos)
  const filteredArticles = useMemo(() => {
    const allArticles = Object.values(artigos);

    if (!articleSearch.trim()) {
      // Retorna todos os 195 artigos
      return allArticles.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    }

    // Filtra por número ou título
    const search = articleSearch.toLowerCase();
    return allArticles.filter(art =>
      art.numero.includes(search) ||
      art.titulo?.toLowerCase().includes(search) ||
      art.ementa.toLowerCase().includes(search)
    ).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [articleSearch, artigos]);

  const hasSearch = searchTerm.trim().length > 0;
  const showSkeleton = isLoading && Object.keys(artigos).length === 0;

  return (
    <main className="min-h-screen bg-surface-raised">
      {/* Header Simplificado */}
      <div className="bg-surface-raised text-ink-primary py-12 border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-surface-page/20 rounded-md flex items-center justify-center">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Lei 14.133/2021</h1>
              <p className="text-xl text-ink-muted">Nova Lei de Licitações e Contratos</p>
            </div>
          </div>

          {/* Campo de Pesquisa Principal */}
          <div className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-ink-muted" />
            <input
              type="text"
              placeholder="Pesquisar por número do artigo, palavra-chave ou tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-5 text-lg text-ink-primary bg-surface-page rounded-md border-2 border-transparent focus:border-white focus:ring-4 focus:ring-white/30"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-ink-muted hover:text-ink-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Link para lei completa */}
          <div className="mt-6">
            <a
              href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-deep text-ink-secondary rounded-[3px] font-semibold hover:bg-surface-deep transition-all text-sm"
            >
              <FileText className="w-4 h-4" />
              Ver Lei Completa no Planalto
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error State */}
        {fetchError && (
          <div role="alert" className="bg-surface-raised border border-amber-accent rounded-[3px] p-4 mb-6">
            <p className="text-amber-accent-deep font-medium">{fetchError}</p>
          </div>
        )}

        {/* Loading / Resultados */}
        {showSkeleton ? (
          <div className="bg-surface-page rounded-md border border-border-subtle p-8" aria-busy="true">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/3 bg-surface-deep rounded" />
              <div className="h-12 w-full bg-surface-deep rounded-md" />
              <div className="space-y-3 pt-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-20 bg-surface-deep rounded-md" />
                ))}
              </div>
            </div>
          </div>
        ) : hasSearch ? (
          <div className="bg-surface-page rounded-md border border-border-subtle p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-ink-primary">
                Resultados da Busca
              </h2>
              <span className="text-sm text-ink-secondary">
                {searchResults.length} {searchResults.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-border-strong mx-auto mb-4" />
                <p className="text-ink-secondary text-lg mb-2">Nenhum artigo encontrado</p>
                <p className="text-ink-muted">Tente usar outros termos de busca</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map(article => (
                  <Link
                    key={article.numero}
                    href={`/artigo/${article.numero}`}
                    className="block p-6 bg-surface-raised rounded-md border border-border-subtle hover:border-brand-600 hover:bg-surface-raised transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 h-16 bg-surface-deep rounded-[3px] flex items-center justify-center text-brand-700 font-bold text-lg group-hover:bg-border-strong transition-colors">
                        {formatArticleNumber(article.numero)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-ink-secondary mb-1">{article.capitulo}</div>
                        <h3 className="text-lg font-bold text-ink-primary mb-2 group-hover:text-brand-700 transition-colors">
                          {article.titulo}
                        </h3>
                        <p className="text-ink-secondary leading-relaxed line-clamp-2">
                          {article.ementa}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tabs de Navegação */}
            <div className="flex items-center gap-4 mb-6 bg-surface-page rounded-md p-2 border border-border-subtle">
              <button
                onClick={() => setMode('articles')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] font-bold transition-all ${
                  mode === 'articles'
                    ? 'bg-brand-600 text-surface-page'
                    : 'text-ink-secondary hover:bg-surface-deep'
                }`}
              >
                <Hash className="w-5 h-5" />
                Buscar por Artigos
              </button>
              <button
                onClick={() => setMode('groups')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[3px] font-bold transition-all ${
                  mode === 'groups'
                    ? 'bg-brand-600 text-surface-page'
                    : 'text-ink-secondary hover:bg-surface-deep'
                }`}
              >
                <List className="w-5 h-5" />
                Navegar por Grupos Temáticos
              </button>
            </div>

            {/* Conteúdo baseado no modo */}
            {mode === 'articles' ? (
              <div className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-ink-primary mb-4">
                    Todos os 195 Artigos da Lei
                  </h2>

                  {/* Campo de busca de artigos */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
                    <input
                      type="text"
                      placeholder="Buscar por número, título ou palavra-chave..."
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 border border-border-strong rounded-md focus:ring-2 focus:ring-amber-accent focus:border-transparent"
                    />
                    {articleSearch && (
                      <button
                        onClick={() => setArticleSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-secondary"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-ink-secondary mt-3">
                    {filteredArticles.length} {filteredArticles.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}
                  </p>
                </div>

                {/* Grid compacto de artigos */}
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-12 gap-2">
                  {filteredArticles.map(article => (
                    <Link
                      key={article.numero}
                      href={`/artigo/${article.numero}`}
                      className="aspect-square bg-surface-deep hover:bg-brand-600 rounded-[3px] flex items-center justify-center font-bold text-brand-700 hover:text-ink-primary transition-all hover:scale-105"
                      title={`Artigo ${article.numero}: ${article.titulo}`}
                    >
                      <span className="text-sm sm:text-base">{article.numero}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-ink-primary mb-2">
                    Grupos Temáticos
                  </h2>
                  <p className="text-ink-secondary">
                    {LEI_14133_GRUPOS.length} grupos organizados por assunto
                  </p>
                </div>

                {selectedGroup ? (
                  // Visualização de grupo selecionado
                  (() => {
                    const group = getGroupById(selectedGroup);
                    if (!group) return null;

                    return (
                      <div>
                        <button
                          onClick={() => setSelectedGroup(null)}
                          className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold mb-6"
                        >
                          <ArrowRight className="w-5 h-5 rotate-180" />
                          Voltar para todos os grupos
                        </button>

                        <div className="bg-surface-raised rounded-md p-6 mb-6 border border-border-subtle">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-brand-600 rounded-md flex items-center justify-center text-2xl flex-shrink-0">
                              {group.icon}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-ink-primary mb-2">
                                {group.title}
                              </h3>
                              <p className="text-ink-secondary leading-relaxed">
                                {group.description}
                              </p>
                              <div className="mt-3 text-sm text-ink-secondary">
                                <strong>{group.articles.length}</strong> artigos neste grupo
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {group.articles.map(numero => {
                            const article = artigos[numero];
                            if (!article) return null;

                            return (
                              <Link
                                key={numero}
                                href={`/artigo/${numero}`}
                                className="block p-5 bg-surface-raised rounded-md border border-border-subtle hover:border-border-strong hover:bg-surface-raised transition-all group"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="flex-shrink-0 w-14 h-14 bg-surface-deep rounded-[3px] flex items-center justify-center text-brand-700 font-bold group-hover:bg-border-strong transition-colors">
                                    {formatArticleNumber(numero)}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                                      {article.titulo}
                                    </h4>
                                    <p className="text-sm text-ink-secondary line-clamp-2">
                                      {article.ementa}
                                    </p>
                                  </div>
                                  <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  // Grid de grupos
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {LEI_14133_GRUPOS.map(group => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedGroup(group.id)}
                        className="text-left p-6 bg-surface-raised rounded-md border border-border-subtle hover:border-border-strong hover:bg-surface-raised hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-12 h-12 bg-surface-deep rounded-md flex items-center justify-center text-2xl group-hover:bg-border-strong transition-colors flex-shrink-0">
                            {group.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                              {group.title}
                            </h3>
                            <p className="text-sm text-ink-secondary">
                              {group.articles.length} artigos
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-ink-secondary line-clamp-2 leading-relaxed">
                          {group.description}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
