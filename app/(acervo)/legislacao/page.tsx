'use client';

import { FileText } from 'lucide-react';
import { useLegislacao } from '@/hooks/use-legislacao';
import { getTabTheme } from '@/lib/legislacao/theme';
import { groupActsByHierarchy } from '@/lib/legislacao/grouping';
import { getHierarchyInfo } from '@/lib/legislative-acts/hierarchy';
import { LegislacaoHero } from '@/components/legislacao/LegislacaoHero';
import { LegislacaoTabs } from '@/components/legislacao/LegislacaoTabs';
import { LegislacaoHighlightCard } from '@/components/legislacao/LegislacaoHighlightCard';
import { LegislacaoToolbar } from '@/components/legislacao/LegislacaoToolbar';
import { LegislacaoFiltersPanel } from '@/components/legislacao/LegislacaoFiltersPanel';
import { LegislacaoActiveChips } from '@/components/legislacao/LegislacaoActiveChips';
import { LegislativeActCard } from '@/components/legislacao/LegislativeActCard';
import { LegislacaoPagination } from '@/components/legislacao/LegislacaoPagination';

export default function LegislacaoPage() {
  const l = useLegislacao();
  const theme = getTabTheme(l.activeTab);

  const isBoasPraticas = l.activeTab === 'boas-praticas';
  const isOrientacoes = l.activeTab === 'orientacoes';
  const isBoasPraticasOrOrientacoes = isBoasPraticas || isOrientacoes;
  const showHierarchyOption = !isBoasPraticas && !isOrientacoes;

  const showGrouped = l.activeTab === 'atos' && l.sortFilter === 'hierarchy' && l.acts.length > 0;
  const groupedActs = showGrouped ? groupActsByHierarchy(l.acts) : null;

  const searchPlaceholder = isBoasPraticasOrOrientacoes
    ? 'Buscar por título ou descrição...'
    : 'Buscar por número, título ou assunto...';

  const itemsLabel = isOrientacoes
    ? 'orientações'
    : isBoasPraticas
    ? 'outros atos normativos'
    : 'atos normativos';

  return (
    <main className="min-h-screen bg-white">
      <LegislacaoHero theme={theme} />
      <LegislacaoTabs activeTab={l.activeTab} counts={l.tabCounts} onSwitch={l.switchTab} />

      <section className="container mx-auto px-4 max-w-6xl py-8">
        <div className="mb-6">
          <LegislacaoToolbar
            searchTerm={l.searchTerm}
            onSearchChange={l.setSearchTerm}
            searchPlaceholder={searchPlaceholder}
            sortFilter={l.sortFilter}
            onSortChange={l.setSortFilter}
            showHierarchyOption={showHierarchyOption}
            hasActiveFilters={l.hasActiveFilters}
            showFilters={l.showFilters}
            onToggleFilters={() => l.setShowFilters(!l.showFilters)}
          />

          {/* Filtros sempre à vista no computador; no celular, atrás do botão. */}
          <div className={l.showFilters ? '' : 'hidden md:block'}>
            <LegislacaoFiltersPanel
              theme={theme}
              showTypeFilter={showHierarchyOption}
              showIssuerAsText={isBoasPraticasOrOrientacoes}
              availableTypes={l.availableTypes}
              availableIssuers={l.availableIssuers}
              availableYears={l.availableYears}
              availableEsferas={l.availableEsferas}
              typeFilter={l.typeFilter}
              onTypeChange={l.setTypeFilter}
              issuerFilter={l.issuerFilter}
              onIssuerChange={l.setIssuerFilter}
              esferaFilter={l.esferaFilter}
              onEsferaChange={l.setEsferaFilter}
              yearFilter={l.yearFilter}
              onYearChange={l.setYearFilter}
              themeFilter={l.themeFilter}
              onThemeChange={l.setThemeFilter}
              hasActiveFilters={l.hasActiveFilters}
              onClear={l.clearFilters}
            />
          </div>

          {l.hasActiveFilters && (
            <LegislacaoActiveChips
              esferaFilter={l.esferaFilter}
              onEsferaClear={() => l.setEsferaFilter('')}
              typeFilter={l.typeFilter}
              onTypeClear={() => l.setTypeFilter('')}
              issuerFilter={l.issuerFilter}
              onIssuerClear={() => l.setIssuerFilter('')}
              yearFilter={l.yearFilter}
              onYearClear={() => l.setYearFilter('')}
              themeFilter={l.themeFilter}
              onThemeClear={() => l.setThemeFilter('')}
              searchTerm={l.searchTerm}
              onSearchClear={() => l.setSearchTerm('')}
              onClearAll={l.clearFilters}
            />
          )}
        </div>

        {l.isLoading ? (
          <div className="text-center py-16">
            <div
              className={`inline-block w-12 h-12 border-4 ${theme.spinnerBorder} border-t-transparent rounded-full animate-spin`}
            />
            <p className="mt-4 text-ink-muted text-lg">{theme.loadingMessage}</p>
          </div>
        ) : l.acts.length === 0 ? (
          <div className="text-center py-16 bg-surface-raised rounded-[6px] border border-border-subtle">
            <FileText className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <h3 className="text-xl font-bold text-ink-primary mb-2">
              {isBoasPraticas ? 'Nenhum ato normativo encontrado' : 'Nenhum ato encontrado'}
            </h3>
            <p className="text-ink-muted max-w-md mx-auto">
              {l.hasActiveFilters
                ? 'Tente ajustar os filtros ou fazer uma nova busca.'
                : isBoasPraticas
                ? 'Outros atos normativos de órgãos federais e estaduais são adicionados regularmente.'
                : 'Não há atos normativos cadastrados no momento.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <p className="text-ink-muted">
                Mostrando <span className="font-semibold">{l.acts.length}</span> de{' '}
                <span className="font-semibold">{l.total}</span> {itemsLabel}
              </p>
              <p className="text-ink-muted">
                Página {l.page} de {l.totalPages}
              </p>
            </div>

            {showGrouped && groupedActs ? (
              <div className="space-y-8">
                {groupedActs.map(([level, levelActs]) => {
                  const meta = getHierarchyInfo(level);
                  const headerLabel = meta?.pluralLabel ?? 'Outros atos (sem nível definido)';
                  return (
                    <section key={level}>
                      <h2 className="flex items-baseline gap-3 pt-4 pb-1 border-b border-border-strong">
                        <span className="text-lg font-semibold text-ink-primary">{headerLabel}</span>
                        <span className="text-sm text-ink-muted">
                          {levelActs.length} {levelActs.length === 1 ? 'ato' : 'atos'} nesta página
                        </span>
                      </h2>
                      <div>
                        {levelActs.map((act) => (
                          <LegislativeActCard key={act.id} act={act} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="border-t border-border-subtle">
                {l.acts.map((act) => (
                  <LegislativeActCard key={act.id} act={act} />
                ))}
              </div>
            )}

            <LegislacaoPagination page={l.page} totalPages={l.totalPages} onPageChange={l.setPage} />
          </>
        )}

        <LegislacaoHighlightCard />
      </section>
    </main>
  );
}
