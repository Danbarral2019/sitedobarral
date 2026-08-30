'use client';

/**
 * /lei-14133/preview — Protótipo de unificação da apresentação da Lei 14.133.
 *
 * Estrutura: copia a UX da /area-restrita/lei-comentada (sidebar + main column),
 * adaptada para público:
 * - Sem botões Histórico/Favoritos
 * - Sem ArticleChatInterface (busca IA do header já cobre)
 * - Documentos: Top 5 destaques (cards) + lista completa por categoria (accordion)
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
import { useLei14133Preview } from '@/hooks/use-lei14133-preview';

function PreviewContent() {
  const preview = useLei14133Preview('/lei-14133/preview');

  const handleSidebarSelect = (item: LeiArticleListItem) => {
    const full = preview.apiData?.articles.find((a) => a.numero === item.numero);
    if (full) preview.selectArticle(full);
  };

  if (preview.loading) {
    return (
      <div className="min-h-screen bg-surface-raised flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-ink-secondary">Carregando Lei 14.133/2021…</p>
        </div>
      </div>
    );
  }

  if (preview.error || !preview.apiData) {
    return (
      <div className="min-h-screen bg-surface-raised flex items-center justify-center p-4">
        <div className="bg-surface-raised border border-border-subtle rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-semantic-error mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink-primary text-center mb-2">Erro ao carregar</h2>
          <p className="text-ink-secondary text-center mb-4">{preview.error || 'Erro desconhecido'}</p>
        </div>
      </div>
    );
  }

  const { apiData, selectedArticle } = preview;
  const hierarchyForSidebar = preview.filteredHierarchy as LeiHierarchy | null;

  const relatedTopics = selectedArticle
    ? CROSS_REFERENCES.filter((r) => r.articles.includes(selectedArticle.numero))
    : [];

  const sidebar = (
    <LeiSidebar
      hierarchy={hierarchyForSidebar}
      selectedNumero={selectedArticle?.numero ?? null}
      expandedTitulos={preview.expandedTitulos}
      expandedCapitulos={preview.expandedCapitulos}
      onToggleTitulo={preview.toggleTitulo}
      onToggleCapitulo={preview.toggleCapitulo}
      onSelectArticle={handleSidebarSelect}
      articleRefs={preview.articleRefs}
    />
  );

  return (
    <div className="min-h-screen bg-surface-raised">
      <LeiPreviewHeader
        searchQuery={preview.searchQuery}
        onSearchChange={preview.setSearchQuery}
        onlyWithDocuments={preview.onlyWithDocuments}
        onToggleOnlyWithDocs={preview.toggleOnlyWithDocs}
        totalArticles={apiData.total}
        totalWithDocs={apiData.totalWithDocuments}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar desktop */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="bg-surface-page rounded-md border border-border-subtle sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 border-b border-border-subtle">
                <h2 className="text-lg font-bold text-ink-primary">Estrutura da Lei</h2>
                <p className="text-sm text-ink-secondary">
                  {Object.keys(preview.filteredHierarchy || {}).length} títulos
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

                <LeiCrossReferences
                  selectedNumero={selectedArticle.numero}
                  topics={relatedTopics}
                  allArticles={apiData.articles}
                  onSelectArticle={preview.selectArticle}
                />

                {selectedArticle.documentCount > 0 && (
                  <LeiArticleDocuments
                    loading={preview.loadingDocs}
                    data={preview.relatedDocs}
                    expandedCategories={preview.expandedCategories}
                    onToggleCategory={preview.toggleCategory}
                  />
                )}

                {selectedArticle.enunciados && (
                  <LeiEnunciadosList enunciados={selectedArticle.enunciados} />
                )}
              </div>
            ) : (
              <div className="bg-surface-page rounded-md border border-border-subtle p-12 text-center">
                <BookOpen className="w-16 h-16 text-border-strong mx-auto mb-4" />
                <p className="text-ink-secondary text-lg mb-2">Selecione um artigo</p>
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
        onClick={preview.openMobileDrawer}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-brand-600 text-surface-page rounded-full flex items-center justify-center hover:bg-brand-800 transition-colors"
        aria-label="Abrir navegação"
      >
        <BookOpen className="w-6 h-6" />
      </button>

      <LeiMobileDrawer open={preview.mobileDrawerOpen} onClose={preview.closeMobileDrawer}>
        {sidebar}
      </LeiMobileDrawer>
    </div>
  );
}

export default function LeiPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-raised flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600" />
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
