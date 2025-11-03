'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, BookOpen, ArrowRight, FileText, X, List, Hash } from 'lucide-react';
import { LEI_14133_ARTIGOS, searchLeiArticles } from '@/data/lei-14133-artigos';
import { LEI_14133_GRUPOS, getGroupById } from '@/data/lei-14133-grupos';
import { formatArticleNumber } from '@/lib/article-utils';

type NavigationMode = 'articles' | 'groups';

export default function ArtigosIndexPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<NavigationMode>('articles');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [articleSearch, setArticleSearch] = useState('');

  // Busca de artigos (global - no topo)
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchLeiArticles(searchTerm);
  }, [searchTerm]);

  // Lista filtrada de artigos (na aba Artigos)
  const filteredArticles = useMemo(() => {
    const allArticles = Object.values(LEI_14133_ARTIGOS);

    if (!articleSearch.trim()) {
      // Retorna todos os 193 artigos
      return allArticles.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
    }

    // Filtra por número ou título
    const search = articleSearch.toLowerCase();
    return allArticles.filter(art =>
      art.numero.includes(search) ||
      art.titulo.toLowerCase().includes(search) ||
      art.ementa.toLowerCase().includes(search)
    ).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [articleSearch]);

  const hasSearch = searchTerm.trim().length > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header Simplificado */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Lei 14.133/2021</h1>
              <p className="text-xl text-blue-100">Nova Lei de Licitações e Contratos</p>
            </div>
          </div>

          {/* Campo de Pesquisa Principal */}
          <div className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por número do artigo, palavra-chave ou tema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-5 text-lg text-gray-900 bg-white rounded-2xl border-2 border-transparent focus:border-white focus:ring-4 focus:ring-white/30 shadow-xl"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/30 transition-all text-sm"
            >
              <FileText className="w-4 h-4" />
              Ver Lei Completa no Planalto
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Resultados de Busca */}
        {hasSearch ? (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Resultados da Busca
              </h2>
              <span className="text-sm text-gray-600">
                {searchResults.length} {searchResults.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-lg mb-2">Nenhum artigo encontrado</p>
                <p className="text-gray-500">Tente usar outros termos de busca</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults.map(article => (
                  <Link
                    key={article.numero}
                    href={`/artigo/${article.numero}`}
                    className="block p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-lg group-hover:bg-blue-200 transition-colors">
                        {formatArticleNumber(article.numero)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-600 mb-1">{article.capitulo}</div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                          {article.titulo}
                        </h3>
                        <p className="text-gray-700 leading-relaxed line-clamp-2">
                          {article.ementa}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Tabs de Navegação */}
            <div className="flex items-center gap-4 mb-6 bg-white rounded-xl p-2 shadow-md border-2 border-gray-200">
              <button
                onClick={() => setMode('articles')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                  mode === 'articles'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Hash className="w-5 h-5" />
                Buscar por Artigos
              </button>
              <button
                onClick={() => setMode('groups')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                  mode === 'groups'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <List className="w-5 h-5" />
                Navegar por Grupos Temáticos
              </button>
            </div>

            {/* Conteúdo baseado no modo */}
            {mode === 'articles' ? (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Todos os 193 Artigos da Lei
                  </h2>

                  {/* Campo de busca de artigos */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por número, título ou palavra-chave..."
                      value={articleSearch}
                      onChange={(e) => setArticleSearch(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {articleSearch && (
                      <button
                        onClick={() => setArticleSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mt-3">
                    {filteredArticles.length} {filteredArticles.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}
                  </p>
                </div>

                {/* Grid compacto de artigos */}
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-12 gap-2">
                  {filteredArticles.map(article => (
                    <Link
                      key={article.numero}
                      href={`/artigo/${article.numero}`}
                      className="aspect-square bg-blue-100 hover:bg-blue-600 rounded-lg flex items-center justify-center font-bold text-blue-700 hover:text-white transition-all hover:scale-105 hover:shadow-md"
                      title={`Artigo ${article.numero}: ${article.titulo}`}
                    >
                      <span className="text-sm sm:text-base">{article.numero}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Grupos Temáticos
                  </h2>
                  <p className="text-gray-600">
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
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6"
                        >
                          <ArrowRight className="w-5 h-5 rotate-180" />
                          Voltar para todos os grupos
                        </button>

                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-6 border-2 border-indigo-200">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                              {group.icon}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {group.title}
                              </h3>
                              <p className="text-gray-700 leading-relaxed">
                                {group.description}
                              </p>
                              <div className="mt-3 text-sm text-gray-600">
                                <strong>{group.articles.length}</strong> artigos neste grupo
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {group.articles.map(numero => {
                            const article = LEI_14133_ARTIGOS[numero];
                            if (!article) return null;

                            return (
                              <Link
                                key={numero}
                                href={`/artigo/${numero}`}
                                className="block p-5 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="flex-shrink-0 w-14 h-14 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-bold group-hover:bg-indigo-200 transition-colors">
                                    {formatArticleNumber(numero)}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">
                                      {article.titulo}
                                    </h4>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {article.ementa}
                                    </p>
                                  </div>
                                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
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
                        className="text-left p-6 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-indigo-200 transition-colors flex-shrink-0">
                            {group.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">
                              {group.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {group.articles.length} artigos
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
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
