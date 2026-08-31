'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, Gavel, Scale, FileText, Lock, ArrowRight,
  X, Loader2, AlertCircle, BookOpen, Sparkles, Database, MessageCircle,
  Newspaper, HelpCircle
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
      excerpts?: string[];
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
    blogPosts: Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      author: string;
      publishedAt: string;
      tags: string | null;
    }>;
    faqs: Array<{
      id: string;
      question: string;
      answer: string;
      category: string | null;
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
  'outro': 'Outro',
  'manual-tcu': 'Manual do TCU',
  'boa_pratica': 'Outros Atos Normativos',
  'ato-normativo': 'Normativos',
  'sumula': 'Súmulas TCU',
  'consulta_tcu': 'Respostas a Consultas TCU',
  'informativo': 'Informativos de Licitação TCU',
};

type TabType = 'all' | 'lei' | 'acts' | 'docs' | 'glossary' | 'blog' | 'faq';

function BuscaIntegradaContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
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
      results.results.documents.length +
      (results.results.blogPosts?.length || 0) +
      (results.results.faqs?.length || 0)
    );
  }, [results]);

  // Tab counts
  const tabCounts = useMemo(() => {
    if (!results) return { lei: 0, acts: 0, docs: 0, glossary: 0, blog: 0, faq: 0 };
    return {
      lei: results.results.articles.length,
      acts: results.results.acts.length,
      docs: results.results.documents.length,
      glossary: results.results.glossaryTerms.length,
      blog: results.results.blogPosts?.length || 0,
      faq: results.results.faqs?.length || 0,
    };
  }, [results]);

  // Filter functions for tabs
  const shouldShowSection = (section: TabType): boolean => {
    if (activeTab === 'all') return true;
    return activeTab === section;
  };

  const hasSearch = debouncedSearch.trim().length >= 2;

  return (
    <main className="min-h-screen bg-surface-raised">
      {/* Header */}
      <div className="bg-surface-raised text-ink-primary py-16 border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-surface-page/20 rounded-md flex items-center justify-center">
              <Search className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Busca Integrada</h1>
              <p className="text-xl text-ink-muted">
                Pesquise em artigos da lei, atos normativos, documentos, blog e FAQ
              </p>
            </div>
          </div>

          {/* Campo de Pesquisa */}
          <div className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-ink-muted" />
            <input
              type="text"
              placeholder="Ex: planejamento, licitação, dispensa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-5 text-lg text-ink-primary bg-surface-page rounded-md border-2 border-transparent focus:border-white focus:ring-4 focus:ring-white/30"
              autoFocus
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

          {hasSearch && (
            <div className="mt-4 text-sm text-surface-page/80">
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
        <div className="bg-surface-page border-b-2 border-border-subtle sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 ${
                  activeTab === 'all'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
                }`}
              >
                Todos ({totalResults})
              </button>

              {tabCounts.glossary > 0 && (
                <button
                  onClick={() => setActiveTab('glossary')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'glossary'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
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
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
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
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
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
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Documentos ({tabCounts.docs})
                </button>
              )}

              {tabCounts.blog > 0 && (
                <button
                  onClick={() => setActiveTab('blog')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'blog'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
                  }`}
                >
                  <Newspaper className="w-4 h-4" />
                  Blog ({tabCounts.blog})
                </button>
              )}

              {tabCounts.faq > 0 && (
                <button
                  onClick={() => setActiveTab('faq')}
                  className={`px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-4 flex items-center gap-2 ${
                    activeTab === 'faq'
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border-strong'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  FAQ ({tabCounts.faq})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {!hasSearch ? (
          <div className="bg-surface-page rounded-md border border-border-subtle p-12">
            <div className="text-center">
              <Search className="w-20 h-20 text-border-strong mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-ink-primary mb-4">
                Como funciona a busca integrada?
              </h2>
              <p className="text-ink-secondary mb-8 max-w-2xl mx-auto">
                Digite qualquer termo relacionado a licitações e contratos. A busca retornará resultados em:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <Gavel className="w-10 h-10 text-brand-600 mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">Lei 14.133/2021</h3>
                  <p className="text-xs text-ink-secondary">195 artigos organizados por capítulos</p>
                </div>

                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <Scale className="w-10 h-10 text-brand-600 mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">Atos Normativos</h3>
                  <p className="text-xs text-ink-secondary">Decretos, portarias e instruções normativas</p>
                </div>

                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <FileText className="w-10 h-10 text-ink-secondary mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">Documentos</h3>
                  <p className="text-xs text-ink-secondary">Acórdãos, pareceres e materiais exclusivos</p>
                </div>

                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <BookOpen className="w-10 h-10 text-ink-secondary mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">Glossário</h3>
                  <p className="text-xs text-ink-secondary">Termos técnicos de licitações</p>
                </div>

                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <Newspaper className="w-10 h-10 text-ink-secondary mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">Blog</h3>
                  <p className="text-xs text-ink-secondary">Artigos e análises especializadas</p>
                </div>

                <div className="p-5 bg-surface-raised rounded-md border border-border-subtle">
                  <HelpCircle className="w-10 h-10 text-amber-accent mx-auto mb-3" />
                  <h3 className="font-bold text-ink-primary mb-1 text-sm">FAQ</h3>
                  <p className="text-xs text-ink-secondary">Perguntas frequentes respondidas</p>
                </div>
              </div>
            </div>
          </div>
        ) : results && totalResults === 0 ? (
          <div className="bg-surface-page rounded-md border border-border-subtle p-12 text-center">
            <AlertCircle className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-ink-primary mb-2">Nenhum resultado encontrado</h2>
            <p className="text-ink-secondary">
              Tente usar outros termos ou palavras-chave relacionadas
            </p>
          </div>
        ) : results && (
          <div className="space-y-8">
            {/* Glossário - Prioridade máxima */}
            {results.results.glossaryTerms.length > 0 && shouldShowSection('glossary') && (
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-8 h-8 text-ink-secondary" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Glossário
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-surface-deep text-ink-secondary rounded-full text-sm font-bold">
                    {results.results.glossaryTerms.length} {results.results.glossaryTerms.length === 1 ? 'termo' : 'termos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.glossaryTerms.map(term => (
                    <div
                      key={term.id}
                      className="p-5 bg-surface-raised rounded-md border border-border-subtle"
                    >
                      <h3 className="font-bold text-lg text-ink-primary mb-2">
                        {term.term}
                      </h3>
                      <p className="text-sm text-ink-secondary leading-relaxed">
                        {term.definition}
                      </p>
                      {term.category && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-surface-deep text-ink-secondary rounded-full">
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
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Gavel className="w-8 h-8 text-brand-600" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Lei 14.133/2021
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-surface-deep text-brand-700 rounded-full text-sm font-bold">
                    {results.results.articles.length} {results.results.articles.length === 1 ? 'artigo' : 'artigos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.articles.map(article => (
                    <Link
                      key={article.numero}
                      href={`/artigo/${article.numero}`}
                      className="block p-5 bg-surface-raised rounded-md border border-border-subtle hover:border-brand-600 hover:bg-surface-deep transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Badge compacto com número do artigo */}
                        <div className="flex-shrink-0 px-3 py-1 bg-brand-600 rounded-md text-surface-page text-xs font-bold">
                          Art. {article.numero}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-brand-600 mb-1">{article.capitulo}</div>

                          {/* Trechos relevantes com destaque */}
                          {article.excerpts && article.excerpts.length > 0 ? (
                            <div className="space-y-2">
                              {article.excerpts.map((excerpt, idx) => (
                                <p
                                  key={idx}
                                  className="text-sm text-ink-secondary leading-relaxed"
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
                            <p className="text-sm text-ink-secondary line-clamp-2">{article.ementa}</p>
                          )}
                        </div>
                        <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Atos Normativos */}
            {results.results.acts.length > 0 && shouldShowSection('acts') && (
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Scale className="w-8 h-8 text-brand-600" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Atos Normativos
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-surface-deep text-brand-700 rounded-full text-sm font-bold">
                    {results.results.acts.length} {results.results.acts.length === 1 ? 'ato' : 'atos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.acts.map(act => (
                    <Link
                      key={act.id}
                      href={`/legislacao#${act.id}`}
                      className="block p-5 bg-surface-raised rounded-md border border-border-subtle hover:border-border-strong hover:bg-surface-deep transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="px-3 py-1 bg-brand-600 text-surface-page text-sm font-bold rounded-[3px]">
                            {act.type.toUpperCase()}
                          </div>
                          <div className="text-center text-xs text-ink-secondary mt-1">{act.fullNumber}</div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                            {act.title}
                          </h3>
                          <p className="text-sm text-ink-secondary line-clamp-2 mb-2">{act.ementa}</p>
                          <div className="text-xs text-ink-muted">{act.issuer}</div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-brand-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Documentos */}
            {results.results.documents.length > 0 && shouldShowSection('docs') && (
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="w-8 h-8 text-ink-secondary" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Documentos
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-surface-deep text-ink-secondary rounded-full text-sm font-bold">
                    {results.results.documents.length} {results.results.documents.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.documents.map(doc => (
                    <div
                      key={doc.id}
                      className={`p-5 rounded-md border-2 transition-all ${
                        doc.requiresEnrollment
                          ? 'bg-surface-raised border-border-strong'
                          : 'bg-surface-raised border-border-subtle hover:border-brand-600 hover:bg-surface-deep'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {doc.requiresEnrollment ? (
                          <div className="flex-shrink-0 w-12 h-12 bg-border-strong rounded-[3px] flex items-center justify-center">
                            <Lock className="w-6 h-6 text-surface-page" />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-12 h-12 bg-brand-600 rounded-[3px] flex items-center justify-center">
                            <FileText className="w-6 h-6 text-surface-page" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-surface-deep text-ink-secondary text-xs font-bold rounded">
                              {CATEGORY_LABELS[doc.category] || doc.category}
                            </span>
                            {doc.requiresEnrollment && (
                              <span className="px-2 py-0.5 bg-surface-deep text-ink-secondary text-xs font-bold rounded flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Requer Inscrição
                              </span>
                            )}
                          </div>
                          <h3 className={`font-bold mb-1 ${doc.requiresEnrollment ? 'text-ink-secondary' : 'text-ink-primary'}`}>
                            {doc.title}
                          </h3>
                          {doc.description && (
                            <p className="text-sm text-ink-secondary line-clamp-2">{doc.description}</p>
                          )}
                        </div>
                        {doc.requiresEnrollment ? (
                          <Link
                            href="/cursos"
                            className="flex-shrink-0 px-4 py-2 bg-brand-600 text-surface-page rounded-[3px] hover:bg-brand-800 transition-colors text-sm font-semibold"
                          >
                            Ver Cursos
                          </Link>
                        ) : (
                          <Link
                            href={`/area-restrita#doc-${doc.id}`}
                            className="flex-shrink-0"
                          >
                            <ArrowRight className="w-5 h-5 text-ink-secondary hover:translate-x-1 transition-transform" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Call to Action para documentos restritos */}
                {results.results.documents.some(d => d.requiresEnrollment) && (
                  <div className="mt-6 p-6 bg-surface-raised rounded-md border border-border-subtle">
                    <div className="flex items-start gap-4">
                      <Lock className="w-8 h-8 text-brand-600 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-bold text-ink-primary mb-2">
                          Quer acesso completo aos documentos exclusivos?
                        </h3>
                        <p className="text-ink-secondary mb-4">
                          Inscreva-se em nossos cursos e tenha acesso ilimitado a acórdãos, pareceres,
                          orientações normativas e muito mais!
                        </p>
                        <Link
                          href="/cursos"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-surface-page rounded-[3px] font-bold hover:bg-brand-800 transition-colors"
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

            {/* Blog Posts */}
            {results.results.blogPosts?.length > 0 && shouldShowSection('blog') && (
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Newspaper className="w-8 h-8 text-ink-secondary" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Blog
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-surface-deep text-ink-secondary rounded-full text-sm font-bold">
                    {results.results.blogPosts.length} {results.results.blogPosts.length === 1 ? 'artigo' : 'artigos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.blogPosts.map(post => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="block p-5 bg-surface-raised rounded-md border border-border-subtle hover:border-brand-600 hover:bg-surface-deep transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-brand-600 rounded-[3px] flex items-center justify-center">
                          <Newspaper className="w-6 h-6 text-surface-page" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-ink-primary mb-1 group-hover:text-ink-secondary transition-colors">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-sm text-ink-secondary line-clamp-2 mb-2">{post.excerpt}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-ink-muted">
                            <span>{post.author}</span>
                            {post.publishedAt && (
                              <span>{new Date(post.publishedAt).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-ink-secondary group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ */}
            {results.results.faqs?.length > 0 && shouldShowSection('faq') && (
              <section className="bg-surface-page rounded-md border border-border-subtle p-8">
                <div className="flex items-center gap-3 mb-6">
                  <HelpCircle className="w-8 h-8 text-amber-accent" />
                  <h2 className="text-2xl font-bold text-ink-primary">
                    Perguntas Frequentes
                  </h2>
                  <span className="ml-auto px-3 py-1 bg-amber-accent-soft text-amber-accent-deep rounded-full text-sm font-bold">
                    {results.results.faqs.length} {results.results.faqs.length === 1 ? 'resultado' : 'resultados'}
                  </span>
                </div>

                <div className="space-y-3">
                  {results.results.faqs.map(faq => (
                    <div
                      key={faq.id}
                      className="p-5 bg-surface-raised rounded-md border border-border-subtle"
                    >
                      <h3 className="font-bold text-ink-primary mb-2 flex items-start gap-2">
                        <HelpCircle className="w-5 h-5 text-amber-accent flex-shrink-0 mt-0.5" />
                        {faq.question}
                      </h3>
                      <p className="text-sm text-ink-secondary leading-relaxed ml-7">
                        {faq.answer}
                      </p>
                      {faq.category && (
                        <div className="mt-2 ml-7">
                          <span className="text-xs px-2 py-1 bg-amber-accent-soft text-amber-accent-deep rounded-full">
                            {faq.category}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Seção de Preview - Recursos Exclusivos para Assinantes */}
      <div className="bg-surface-raised py-16 mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-ink-primary mb-3">
              Recursos exclusivos para assinantes
            </h2>
            <p className="text-ink-secondary max-w-2xl mx-auto">
              Potencialize sua pesquisa com ferramentas avançadas e acesso completo a toda a base de conhecimento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Card: Análise com IA */}
            <div className="bg-surface-page rounded-md border border-border-subtle p-8 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-surface-deep rounded-md flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-ink-secondary" />
              </div>
              <h3 className="text-lg font-bold text-ink-primary mb-3">Análise com IA</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Na área restrita, a IA analisa seus resultados e gera resumos contextuais automaticamente
              </p>
            </div>

            {/* Card: Base de Conhecimento */}
            <div className="bg-surface-page rounded-md border border-border-subtle p-8 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-surface-deep rounded-md flex items-center justify-center mb-5">
                <Database className="w-8 h-8 text-brand-600" />
              </div>
              <h3 className="text-lg font-bold text-ink-primary mb-3">Base de Conhecimento</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Mais de 800 documentos organizados: Acórdãos TCU, Pareceres, Orientações Normativas, Enunciados...
              </p>
            </div>

            {/* Card: Assistente Virtual */}
            <div className="bg-surface-page rounded-md border border-border-subtle p-8 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-surface-deep rounded-md flex items-center justify-center mb-5">
                <MessageCircle className="w-8 h-8 text-ink-secondary" />
              </div>
              <h3 className="text-lg font-bold text-ink-primary mb-3">Assistente Virtual</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                Tire dúvidas diretamente com nosso assistente especializado em licitações
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Link
              href="/planos"
              className="inline-flex items-center gap-3 px-8 py-4 bg-brand-600 text-surface-page rounded-md font-bold text-lg hover: transition-all hover:shadow-xl"
            >
              Assine e tenha acesso completo
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function BuscaIntegradaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-surface-raised" />}>
      <BuscaIntegradaContent />
    </Suspense>
  );
}
