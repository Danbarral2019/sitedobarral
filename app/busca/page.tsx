'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Gavel, Scale, FileText, Lock, ArrowRight,
  X, Loader2, AlertCircle, BookOpen
} from 'lucide-react';

interface SearchResults {
  query: string;
  results: {
    glossaryTerms: Array<{
      id: string;
      term: string;
      definition: string;
      category: string | null;
    }>;
    articles: Array<{
      numero: string;
      titulo: string;
      ementa: string;
      capitulo: string;
      excerpts?: string[]; // Trechos relevantes com termos destacados
    }>;
    acts: Array<{
      id: string;
      fullNumber: string;
      title: string;
      ementa: string;
      type: string;
      issuer: string;
      publishDate: string;
    }>;
    documents: Array<{
      id: string;
      title: string;
      description: string | null;
      category: string;
      type: string;
      url: string;
      courseId: string;
      uploadedAt: Date;
      isPublic: boolean;
      hasAccess: boolean;
      requiresEnrollment: boolean;
    }>;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  'apostila': 'Apostila',
  'acordao': 'Acórdão',
  'parecer': 'Parecer',
  'edital': 'Edital',
  'artigo': 'Artigo',
  'orientacao-normativa': 'Orientação Normativa',
  'enunciados': 'Enunciado',
  'outro': 'Outro'
};

type TabType = 'all' | 'lei' | 'acts' | 'docs' | 'glossary';

export default function BuscaIntegradaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch results when debounced search changes
  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setResults(null);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/busca-integrada?q=${encodeURIComponent(debouncedSearch)}`);
        if (!response.ok) throw new Error('Erro ao buscar');
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error('Erro ao buscar:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearch]);

  const totalResults = useMemo(() => {
    if (!results) return 0;
    return (
      results.results.glossaryTerms.length +
      results.results.articles.length +
      results.results.acts.length +
      results.results.documents.length
    );
  }, [results]);

  // Tab counts
  const tabCounts = useMemo(() => {
    if (!results) return { lei: 0, acts: 0, docs: 0, glossary: 0 };
    return {
      lei: results.results.articles.length,
      acts: results.results.acts.length,
      docs: results.results.documents.length,
      glossary: results.results.glossaryTerms.length,
    };
  }, [results]);

  // Filter functions for tabs
  const shouldShowSection = (section: TabType): boolean => {
    if (activeTab === 'all') return true;
    return activeTab === section;
  };

  const hasSearch = debouncedSearch.trim().length >= 2;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <Search className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Busca Integrada</h1>
              <p className="text-xl text-blue-100">
                Pesquise em glossário, artigos, atos normativos e documentos
              </p>
            </div>
          </div>

          {/* Campo de Pesquisa */}
          <div className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Ex: planejamento, licitação, dispensa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-5 text-lg text-gray-900 bg-white rounded-2xl border-2 border-transparent focus:border-white focus:ring-4 focus:ring-white/30 shadow-xl"
              autoFocus
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

          {hasSearch && (
            <div className="mt-4 text-sm text-white/80">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando...
                </span>
              ) : totalResults > 0 ? (
                <span>{totalResults} {totalResults === 1 ? 'resultado encontrado' : 'resultados encontrados'}</span>
              ) : results ? (
                <span>Nenhum resultado encontrado</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Tabs - Only show when there are results */}
      {hasSearch && results && totalResults > 0 && (
        <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 ${
                  activeTab === 'all'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                Todos ({totalResults})
              </button>

              {tabCounts.glossary > 0 && (
                <button
                  onClick={() => setActiveTab('glossary')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'glossary'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Glossário ({tabCounts.glossary})
                </button>
              )}

              {tabCounts.lei > 0 && (
                <button
                  onClick={() => setActiveTab('lei')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'lei'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Gavel className="w-4 h-4" />
                  Lei 14.133 ({tabCounts.lei})
                </button>
              )}

              {tabCounts.acts > 0 && (
                <button
                  onClick={() => setActiveTab('acts')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'acts'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  Atos Normativos ({tabCounts.acts})
                </button>
              )}

              {tabCounts.docs > 0 && (
                <button
                  onClick={() => setActiveTab('docs')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'docs'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Documentos ({tabCounts.docs})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {!hasSearch ? (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12">
            <div className="text-center">
              <Search className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Como funciona a busca integrada?
              </h2>
              <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                Digite qualquer termo relacionado a licitações e contratos. A busca retornará resultados em:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <Gavel className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Lei 14.133/2021</h3>
                  <p className="text-sm text-gray-600">195 artigos organizados por capítulos</p>
                </div>

                <div className="p-6 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                  <Scale className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Atos Normativos</h3>
                  <p className="text-sm text-gray-600">Decretos, portarias e instruções normativas</p>
                </div>

                <div className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
                  <FileText className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-bold text-gray-900 mb-2">Documentos</h3>
                  <p className="text-sm text-gray-600">Acórdãos, pareceres e materiais exclusivos</p>
                </div>
              </div>
            </div>
          </div>
        ) : results && totalResults === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum resultado encontrado</h2>
            <p className="text-gray-600">
              Tente usar outros termos ou palavras-chave relacionadas
            </p>
          </div>
        ) : results && (
          <div className="space-y-8">
            {/* Glossário - Prioridade máxima */}
            {results.results.glossaryTerms.length > 0 && shouldShowSection('glossary') && (
              <section className="bg-white rounded-2xl shadow-lg border-2 border-green-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-8 h-8 text-green-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Glossário
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                    {results.results.glossaryTerms.length} {results.results.glossaryTerms.length === 1 ? 'termo' : 'termos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.glossaryTerms.map(term => (
                    <div
                      key={term.id}
                      className="p-5 bg-green-50 rounded-xl border-2 border-green-200"
                    >
                      <h3 className="font-bold text-lg text-gray-900 mb-2">
                        {term.term}
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {term.definition}
                      </p>
                      {term.category && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            {term.category}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Artigos da Lei 14.133 */}
            {results.results.articles.length > 0 && shouldShowSection('lei') && (
              <section className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Gavel className="w-8 h-8 text-blue-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Lei 14.133/2021
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                    {results.results.articles.length} {results.results.articles.length === 1 ? 'artigo' : 'artigos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.articles.map(article => (
                    <Link
                      key={article.numero}
                      href={`/artigo/${article.numero}`}
                      className="block p-5 bg-blue-50 rounded-xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-100 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Badge compacto com número do artigo */}
                        <div className="flex-shrink-0 px-3 py-1 bg-blue-600 rounded-md text-white text-xs font-bold">
                          Art. {article.numero}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-blue-600 mb-1">{article.capitulo}</div>

                          {/* Trechos relevantes com destaque */}
                          {article.excerpts && article.excerpts.length > 0 ? (
                            <div className="space-y-2">
                              {article.excerpts.map((excerpt, idx) => (
                                <p
                                  key={idx}
                                  className="text-sm text-gray-700 leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: excerpt.replace(
                                      /<mark>/g,
                                      '<mark class="bg-yellow-200 font-semibold px-1 rounded">'
                                    )
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 line-clamp-2">{article.ementa}</p>
                          )}
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Atos Normativos */}
            {results.results.acts.length > 0 && shouldShowSection('acts') && (
              <section className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Scale className="w-8 h-8 text-indigo-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Atos Normativos
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
                    {results.results.acts.length} {results.results.acts.length === 1 ? 'ato' : 'atos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.acts.map(act => (
                    <Link
                      key={act.id}
                      href={`/legislacao#${act.id}`}
                      className="block p-5 bg-indigo-50 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-100 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-indigo-600 text-white text-sm font-bold rounded-lg">
                            {act.type.toUpperCase()}
                          </div>
                          <div className="text-center text-xs text-gray-600 mt-1">{act.fullNumber}</div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-indigo-700 transition-colors">
                            {act.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{act.ementa}</p>
                          <div className="text-xs text-gray-500">{act.issuer}</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Documentos */}
            {results.results.documents.length > 0 && shouldShowSection('docs') && (
              <section className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="w-8 h-8 text-purple-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Documentos
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                    {results.results.documents.length} {results.results.documents.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.documents.map(doc => (
                    <div
                      key={doc.id}
                      className={`p-5 rounded-xl border-2 transition-all ${
                        doc.requiresEnrollment
                          ? 'bg-gray-50 border-gray-300'
                          : 'bg-purple-50 border-purple-200 hover:border-purple-500 hover:bg-purple-100'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {doc.requiresEnrollment ? (
                          <div className="flex-shrink-0 w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center">
                            <Lock className="w-6 h-6 text-white" />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                              {CATEGORY_LABELS[doc.category] || doc.category}
                            </span>
                            {doc.requiresEnrollment && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Requer Inscrição
                              </span>
                            )}
                          </div>
                          <h3 className={`font-bold mb-1 ${doc.requiresEnrollment ? 'text-gray-600' : 'text-gray-900'}`}>
                            {doc.title}
                          </h3>
                          {doc.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{doc.description}</p>
                          )}
                        </div>
                        {doc.requiresEnrollment ? (
                          <Link
                            href="/cursos"
                            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                          >
                            Ver Cursos
                          </Link>
                        ) : (
                          <Link
                            href={`/area-restrita#doc-${doc.id}`}
                            className="flex-shrink-0"
                          >
                            <ArrowRight className="w-5 h-5 text-purple-600 hover:translate-x-1 transition-transform" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Call to Action para documentos restritos */}
                {results.results.documents.some(d => d.requiresEnrollment) && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                    <div className="flex items-start gap-4">
                      <Lock className="w-8 h-8 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-2">
                          Quer acesso completo aos documentos exclusivos?
                        </h3>
                        <p className="text-gray-700 mb-4">
                          Inscreva-se em nossos cursos e tenha acesso ilimitado a acórdãos, pareceres,
                          orientações normativas e muito mais!
                        </p>
                        <Link
                          href="/cursos"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                        >
                          Conhecer os Cursos
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
