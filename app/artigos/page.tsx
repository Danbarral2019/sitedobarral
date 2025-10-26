'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, FileText, BookOpen, ArrowRight } from 'lucide-react';
import { LEI_14133_ARTIGOS, ARTIGOS_POPULARES, searchLeiArticles } from '@/data/lei-14133-artigos';

export default function ArtigosIndexPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCapitulo, setSelectedCapitulo] = useState<string>('');

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

    // Filtro por busca
    if (searchTerm.trim()) {
      articles = searchLeiArticles(searchTerm);
    }

    // Filtro por capítulo
    if (selectedCapitulo) {
      articles = articles.filter(art => art.capitulo === selectedCapitulo);
    }

    return articles.sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
  }, [searchTerm, selectedCapitulo]);

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
          {(searchTerm || selectedCapitulo) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Mostrando {filteredArticles.length} de 193 artigos
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCapitulo('');
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
                return (
                  <Link
                    key={article.numero}
                    href={`/artigo/${article.numero}`}
                    className="group block p-5 bg-gray-50 rounded-xl hover:bg-blue-50 transition-all border-2 border-transparent hover:border-blue-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-20 h-20 rounded-lg flex items-center justify-center text-2xl font-bold ${
                        isPopular
                          ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {article.numero}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                            Artigo {article.numero}
                          </h3>
                          {isPopular && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                              ⭐ Popular
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2 leading-relaxed">
                          {article.ementa}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                            {article.capitulo}
                          </span>
                          {article.secao && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
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
