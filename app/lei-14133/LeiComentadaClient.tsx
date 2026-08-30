'use client';

/**
 * Cliente da Lei 14.133 Comentada — apresentação pública.
 *
 * Sidebar (Estrutura da Lei) + main column (artigo selecionado).
 * Documentos: Top 5 destaques + lista por categoria (accordion).
 * Comentário do prof, leitura combinada e sugestões de leitura.
 *
 * A versão logada (/area-restrita/lei-comentada) tem a mesma estrutura
 * mas inclui Favoritos/Histórico e botão de favoritar nos docs.
 */

import { Suspense } from 'react';
import { BookOpen, Loader2, AlertCircle } from 'lucide-react';
import { CROSS_REFERENCES } from '@/data/lei-14133-cross-references';
import {
  LeiSidebar,
  type LeiHierarchy,
  type LeiArticleListItem,
} from '@/components/lei-14133/LeiSidebar';
import { LeiPreviewHeader } from '@/components/lei-14133/LeiPreviewHeader';
import { ArticleFull } from '@/components/lei-14133/ArticleFull';
import { LeiCrossReferences } from '@/components/lei-14133/LeiCrossReferences';
import { LeiArticleDocuments } from '@/components/lei-14133/LeiArticleDocuments';
import { LeiEnunciadosList } from '@/components/lei-14133/LeiEnunciadosList';
import { LeiMobileDrawer } from '@/components/lei-14133/LeiMobileDrawer';
import { LeiProfessorComment } from '@/components/lei-14133/LeiProfessorComment';
import { LeiCuratedCrossRefs } from '@/components/lei-14133/LeiCuratedCrossRefs';
import { LeiSuggestedReadings } from '@/components/lei-14133/LeiSuggestedReadings';
import { useLei14133Preview } from '@/hooks/use-lei14133-preview';

function LeiComentadaContent() {
  const reader = useLei14133Preview('/lei-14133');

  const handleSidebarSelect = (item: LeiArticleListItem) => {
    const full = reader.apiData?.articles.find((a) => a.numero === item.numero);
    if (full) reader.selectArticle(full);
  };

  if (reader.loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-ink-secondary">Carregando Lei 14.133/2021…</p>
        </div>
      </div>
    );
  }

  if (reader.error || !reader.apiData) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <div className="bg-surface-raised border border-border-subtle rounded-md p-7 max-w-md">
          <AlertCircle className="w-8 h-8 text-semantic-error mx-auto mb-3" />
          <h2 className="font-heading text-[1.25rem] text-ink-primary text-center mb-2">Erro ao carregar</h2>
          <p className="text-sm text-ink-secondary text-center">{reader.error || 'Erro desconhecido'}</p>
        </div>
      </div>
    );
  }

  const { apiData, selectedArticle } = reader;
  const hierarchyForSidebar = reader.filteredHierarchy as LeiHierarchy | null;

  const relatedTopics = selectedArticle
    ? CROSS_REFERENCES.filter((r) => r.articles.includes(selectedArticle.numero))
    : [];

  const sidebar = (
    <LeiSidebar
      hierarchy={hierarchyForSidebar}
      selectedNumero={selectedArticle?.numero ?? null}
      expandedTitulos={reader.expandedTitulos}
      expandedCapitulos={reader.expandedCapitulos}
      onToggleTitulo={reader.toggleTitulo}
      onToggleCapitulo={reader.toggleCapitulo}
      onSelectArticle={handleSidebarSelect}
      articleRefs={reader.articleRefs}
    />
  );

  return (
    <div className="min-h-screen bg-surface-page">
      <LeiPreviewHeader
        searchQuery={reader.searchQuery}
        onSearchChange={reader.setSearchQuery}
        onlyWithDocuments={reader.onlyWithDocuments}
        onToggleOnlyWithDocs={reader.toggleOnlyWithDocs}
        totalArticles={apiData.total}
        totalWithDocs={apiData.totalWithDocuments}
      />

      {/* Três colunas: estrutura da lei, coluna de leitura e o que o acervo
          reúne. A leitura fica no meio, com medida controlada pelo próprio
          ArticleFull (65ch), e o material relacionado sai de baixo do texto
          para um trilho ao lado, onde não interrompe a leitura corrida. */}
      <div className="container mx-auto px-4 max-w-[1280px] py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-8">
          {/* Estrutura da lei */}
          <nav aria-label="Estrutura da lei" className="hidden lg:block lg:col-span-3">
            <div className="sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="pb-3 mb-1 border-b border-border-subtle">
                <h2 className="font-label text-ink-muted">Estrutura da lei</h2>
                <p className="text-sm text-ink-muted mt-1.5">
                  <span className="font-mono text-ink-primary">
                    {Object.keys(reader.filteredHierarchy || {}).length}
                  </span>{' '}
                  títulos
                </p>
              </div>
              {sidebar}
            </div>
          </nav>

          {/* Coluna de leitura */}
          <div className="lg:col-span-6">
            {selectedArticle ? (
              <div>
                {selectedArticle.capituloCompleto && (
                  <p className="font-label text-ink-muted mb-4">
                    {selectedArticle.capituloCompleto}
                    {selectedArticle.titulo ? ` · ${selectedArticle.titulo}` : ''}
                  </p>
                )}

                <ArticleFull numero={selectedArticle.numero} ementa={selectedArticle.ementa} />

                {selectedArticle.professorComment && (
                  <div className="mt-8">
                    <LeiProfessorComment comment={selectedArticle.professorComment} />
                  </div>
                )}

                {selectedArticle.suggestedReadings && (
                  <div className="mt-8">
                    <LeiSuggestedReadings readings={selectedArticle.suggestedReadings} />
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-border-subtle rounded-md bg-surface-raised p-10 text-center">
                <p className="font-heading text-[1.25rem] text-ink-primary mb-2">
                  Selecione um artigo
                </p>
                <p className="text-sm text-ink-secondary max-w-[46ch] mx-auto">
                  Navegue pela estrutura da lei ao lado, ou busque pelo número do artigo no campo
                  acima.
                </p>
              </div>
            )}
          </div>

          {/* O que o acervo reúne sobre o artigo */}
          {selectedArticle && (
            <aside aria-label="Material relacionado" className="lg:col-span-3 space-y-8">
              {selectedArticle.crossRefs && (
                <LeiCuratedCrossRefs
                  refs={selectedArticle.crossRefs}
                  allArticles={apiData.articles}
                  onSelectArticle={reader.selectArticle}
                />
              )}

              <LeiCrossReferences
                selectedNumero={selectedArticle.numero}
                topics={relatedTopics}
                allArticles={apiData.articles}
                onSelectArticle={reader.selectArticle}
              />

              {selectedArticle.documentCount > 0 && (
                <div id="pareceres" className="scroll-mt-24">
                  <LeiArticleDocuments
                    loading={reader.loadingDocs}
                    data={reader.relatedDocs}
                    expandedCategories={reader.expandedCategories}
                    onToggleCategory={reader.toggleCategory}
                  />
                </div>
              )}

              {selectedArticle.enunciados && (
                <LeiEnunciadosList enunciados={selectedArticle.enunciados} />
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={reader.openMobileDrawer}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-brand-600 text-surface-page rounded-full flex items-center justify-center hover:bg-brand-800 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-accent/25"
        aria-label="Abrir navegação"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      <LeiMobileDrawer open={reader.mobileDrawerOpen} onClose={reader.closeMobileDrawer}>
        {sidebar}
      </LeiMobileDrawer>
    </div>
  );
}

export default function LeiComentadaClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-page flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
        </div>
      }
    >
      <LeiComentadaContent />
    </Suspense>
  );
}
