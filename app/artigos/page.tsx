'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, FileText, BookOpen, ArrowRight, TrendingUp, X } from 'lucide-react';
import { LEI_14133_ARTIGOS, ARTIGOS_POPULARES, searchLeiArticles } from '@/data/lei-14133-artigos';
import { LEI_14133_GRUPOS, GRUPOS_POPULARES, getGroupById } from '@/data/lei-14133-grupos';
import { getArticleIcon, formatArticleNumber, getArticleBadgeClasses } from '@/lib/article-utils';
import { ArticleTreeNavigator } from '@/components/ArticleTreeNavigator';

interface ArticleStats {
  numero: string;
  documentCount: number;
  viewCount: number;
}

export default function ArtigosIndexPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCapitulo, setSelectedCapitulo] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [stats, setStats] = useState<ArticleStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar estatísticas dos artigos
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/analytics/top-articles?limit=193');
        if (response.ok) {
          const data = await response.json();
          setStats(data.articles || []);
        }
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Mapa de estatísticas
  const statsMap = useMemo(() => {
    const map: Record<string, ArticleStats> = {};
    stats.forEach(stat => {
      map[stat.numero] = stat;
    });
    return map;
  }, [stats]);

  // Top 10 para mapa de calor
  const topArticles = useMemo(() => {
    return stats.slice(0, 10);
  }, [stats]);

  // Extrai capítulos únicos
  const capitulos = useMemo(() => {
    const caps = new Set<string>();
    Object.values(LEI_14133_ARTIGOS).forEach(art => {
      caps.add(art.capitulo);
    });
    return Array.from(caps).sort();
  }, []);

  // Filtra artigos
  const filteredArticles = useMemo(() => {
    let articles = Object.values(LEI_14133_ARTIGOS);

    // Filtro por grupo temático
    if (selectedGroup) {
      const group = getGroupById(selectedGroup);
      if (group) {
        articles = articles.filter(art => group.articles.includes(art.numero));
      }
    }

    // Filtro por busca
    if (searchTerm.trim()) {
      const searchResults = searchLeiArticles(searchTerm);
      const searchNumeros = new Set(searchResults.map(a => a.numero));
      articles = articles.filter(art => searchNumeros.has(art.numero));
    }

    // Filtro por capítulo
    if (selectedCapitulo) {
      articles = articles.filter(art => art.capitulo === selectedCapitulo);
    }

    return articles.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [searchTerm, selectedCapitulo, selectedGroup]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-start gap-4 mb-6">
            <BookOpen className="w-16 h-16 flex-shrink-0" />
            <div>
              <h1 className="text-5xl font-bold mb-4">
                Lei 14.133/2021
              </h1>
              <p className="text-2xl text-white/90 mb-2">
                Nova Lei de Licitações e Contratos Administrativos
              </p>
              <p className="text-lg text-white/80">
                Explore todos os 193 artigos com materiais relacionados
              </p>
            </div>
          </div>

          {/* Link para lei completa */}
          <a
            href="https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/30 transition-all"
          >
            <FileText className="w-5 h-5" />
            Ver Lei Completa no Planalto
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Mapa de Calor - Top 10 */}
        {!loading && topArticles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-orange-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                🔥 Mapa de Calor - Artigos Mais Consultados
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {topArticles.map((stat, index) => {
                const intensity = Math.min(100, (stat.viewCount / topArticles[0].viewCount) * 100);
                const bgColor = intensity > 75 ? 'from-red-500 to-red-600' :
                               intensity > 50 ? 'from-orange-500 to-orange-600' :
                               intensity > 25 ? 'from-yellow-500 to-yellow-600' : 'from-green-500 to-green-600';

                return (
                  <Link
                    key={stat.numero}
                    href={`/artigo/${stat.numero}`}
                    className={`bg-gradient-to-br ${bgColor} text-white rounded-lg p-3 hover:scale-105 transition-transform shadow-lg`}
                    title={`${formatArticleNumber(stat.numero)} - ${stat.documentCount} docs, ${stat.viewCount} views`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{getArticleIcon(stat.numero)}</div>
                      <div className="font-bold text-sm">{formatArticleNumber(stat.numero)}</div>
                      <div className="text-[10px] opacity-90 mt-1">
                        {stat.documentCount} docs
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Grupos Temáticos */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              📂 Grupos Temáticos da Lei
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {GRUPOS_POPULARES.map(groupId => {
              const group = getGroupById(groupId);
              if (!group) return null;

              const isSelected = selectedGroup === groupId;

              return (
                <button
                  key={groupId}
                  onClick={() => setSelectedGroup(isSelected ? null : groupId)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">{group.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 mb-1">
                        {group.title}
                      </h3>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {group.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.articles.length} artigos
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedGroup && (
            <button
              onClick={() => setSelectedGroup(null)}
              className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <X className="w-4 h-4" />
              Limpar filtro de grupo ({getGroupById(selectedGroup)?.title})
            </button>
          )}
        </div>

        {/* Navegador em Árvore */}
        <div className="mb-8">
          <ArticleTreeNavigator
            stats={statsMap}
            onArticleClick={(num) => console.log('Clicked article:', num)}
          />
        </div>

        {/* Artigos Populares */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-4xl">⭐</span>
            Artigos Mais Consultados
          </h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {ARTIGOS_POPULARES.map(numero => {
              const article = LEI_14133_ARTIGOS[numero];
              return (
                <Link
                  key={numero}
                  href={`/artigo/${numero}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 border-2 border-orange-200 hover:border-orange-400"
                >
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    Art. {numero}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3 group-hover:text-gray-900 transition-colors">
                    {article.ementa}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-gray-200">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Busca */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                🔍 Buscar Artigos
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Digite número ou palavra-chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                />
              </div>
            </div>

            {/* Filtro por Capítulo */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                📚 Filtrar por Capítulo
              </label>
              <select
                value={selectedCapitulo}
                onChange={(e) => setSelectedCapitulo(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              >
                <option value="">Todos os Capítulos</option>
                {capitulos.map(cap => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumo dos filtros */}
          {(searchTerm || selectedCapitulo || selectedGroup) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Mostrando {filteredArticles.length} de 193 artigos
                  {selectedGroup && ` no grupo "${getGroupById(selectedGroup)?.title}"`}
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCapitulo('');
                    setSelectedGroup(null);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Artigos */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            📋 Todos os Artigos ({filteredArticles.length})
          </h2>

          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                Nenhum artigo encontrado com os filtros selecionados.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCapitulo('');
                  setSelectedGroup(null);
                }}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredArticles.map(article => {
                const isPopular = ARTIGOS_POPULARES.includes(article.numero);
                const stat = statsMap[article.numero];
                const badgeClasses = getArticleBadgeClasses(article.numero, false);

                return (
                  <Link
                    key={article.numero}
                    href={`/artigo/${article.numero}`}
                    className="group block p-5 bg-gray-50 rounded-xl hover:bg-blue-50 transition-all border-2 border-transparent hover:border-blue-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-20 h-20 rounded-lg flex flex-col items-center justify-center ${
                          isPopular
                            ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          <div className="text-xl mb-1">{getArticleIcon(article.numero)}</div>
                          <div className="text-sm font-bold">{article.numero}</div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={badgeClasses}>
                            {formatArticleNumber(article.numero)}
                          </span>
                          {isPopular && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                              ⭐ Popular
                            </span>
                          )}
                          {stat && (stat.documentCount > 0 || stat.viewCount > 0) && (
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              {stat.documentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  📄 {stat.documentCount} docs
                                </span>
                              )}
                              {stat.viewCount > 0 && (
                                <span className="flex items-center gap-1">
                                  👁️ {stat.viewCount} views
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2 leading-relaxed">
                          {article.ementa}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {article.secao && (
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-medium">
                              {article.secao}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl shadow-lg p-8 text-white">
            <h3 className="text-2xl font-bold mb-3">
              Aprofunde seus conhecimentos
            </h3>
            <p className="text-white/90 mb-6">
              Conheça nossos cursos especializados em Lei 14.133/2021 e contratos administrativos
            </p>
            <Link
              href="/cursos"
              className="inline-block px-6 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-md"
            >
              Ver Cursos Disponíveis
            </Link>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
            <h3 className="text-2xl font-bold mb-3">
              Acesse conteúdo exclusivo
            </h3>
            <p className="text-white/90 mb-6">
              Materiais complementares, apostilas e pareceres sobre os artigos da lei
            </p>
            <Link
              href="/area-restrita"
              className="inline-block px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-md"
            >
              Área Restrita
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
