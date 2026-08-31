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
import { LeiArticleCard } from '@/components/lei-14133/LeiArticleCard';
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
      <div className="min-h-screen bg-surface-raised flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-ink-muted">Carregando Lei 14.133/2021…</p>
        </div>
      </div>
    );
  }

  if (reader.error || !reader.apiData) {
    return (
      <div className="min-h-screen bg-surface-raised flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-[6px] p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 text-center mb-2">Erro ao carregar</h2>
          <p className="text-red-700 text-center mb-4">{reader.error || 'Erro desconhecido'}</p>
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
    <div className="min-h-screen bg-surface-raised">
      <LeiPreviewHeader
        searchQuery={reader.searchQuery}
        onSearchChange={reader.setSearchQuery}
        onlyWithDocuments={reader.onlyWithDocuments}
        onToggleOnlyWithDocs={reader.toggleOnlyWithDocs}
        totalArticles={apiData.total}
        totalWithDocs={apiData.totalWithDocuments}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar desktop */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-white rounded-[6px] sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto border border-border-subtle">
              <div className="p-4 border-b border-border-subtle">
                <h2 className="text-lg font-bold text-ink-primary">Estrutura da Lei</h2>
                <p className="text-sm text-ink-muted">
                  {Object.keys(reader.filteredHierarchy || {}).length} títulos
                </p>
              </div>
              {sidebar}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8">
            {selectedArticle ? (
              <div className="space-y-6">
                <LeiArticleCard
                  numero={selectedArticle.numero}
                  titulo={selectedArticle.titulo}
                  capituloCompleto={selectedArticle.capituloCompleto}
                  ementa={selectedArticle.ementa}
                  documentCount={selectedArticle.documentCount}
                />

                {selectedArticle.professorComment && (
                  <LeiProfessorComment comment={selectedArticle.professorComment} />
                )}

                {selectedArticle.crossRefs && (
                  <LeiCuratedCrossRefs
                    refs={selectedArticle.crossRefs}
                    allArticles={apiData.articles}
                    onSelectArticle={reader.selectArticle}
                  />
                )}

                {selectedArticle.suggestedReadings && (
                  <LeiSuggestedReadings readings={selectedArticle.suggestedReadings} />
                )}

                <LeiCrossReferences
                  selectedNumero={selectedArticle.numero}
                  topics={relatedTopics}
                  allArticles={apiData.articles}
                  onSelectArticle={reader.selectArticle}
                />

                {selectedArticle.documentCount > 0 && (
                  <LeiArticleDocuments
                    loading={reader.loadingDocs}
                    data={reader.relatedDocs}
                    expandedCategories={reader.expandedCategories}
                    onToggleCategory={reader.toggleCategory}
                  />
                )}

                {selectedArticle.enunciados && (
                  <LeiEnunciadosList enunciados={selectedArticle.enunciados} />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[6px] p-12 text-center border border-border-subtle">
                <BookOpen className="w-16 h-16 text-ink-muted mx-auto mb-4" />
                <p className="text-ink-muted text-lg mb-2">Selecione um artigo</p>
                <p className="text-ink-muted text-sm">
                  Navegue pela estrutura da lei ao lado e selecione um artigo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={reader.openMobileDrawer}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-brand-600 text-white rounded-full flex items-center justify-center hover:bg-brand-700 transition-colors border border-border-subtle"
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
        <div className="min-h-screen bg-surface-raised flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600" />
        </div>
      }
    >
      <LeiComentadaContent />
    </Suspense>
  );
}
