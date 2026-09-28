'use client';

import type { LegislacaoTab } from '@/lib/legislacao/theme';
import type { TabCounts } from '@/hooks/use-legislacao';

const TABS: Array<{ key: LegislacaoTab; label: string; countKey: keyof TabCounts }> = [
  { key: 'atos', label: 'Atos normativos', countKey: 'atos' },
  { key: 'tic', label: 'Contratações de TIC', countKey: 'tic' },
  { key: 'boas-praticas', label: 'Outros atos', countKey: 'boasPraticas' },
  { key: 'orientacoes', label: 'Orientações', countKey: 'orientacoes' },
];

interface LegislacaoTabsProps {
  activeTab: LegislacaoTab;
  counts: TabCounts;
  onSwitch: (tab: LegislacaoTab) => void;
}

/**
 * Abas da listagem. No celular a faixa rola na horizontal, sem quebrar a
 * página; a aba ativa leva sublinhado na cor da marca.
 */
export function LegislacaoTabs({ activeTab, counts, onSwitch }: LegislacaoTabsProps) {
  return (
    <nav className="border-b border-border-subtle bg-white">
      <div
        role="tablist"
        aria-label="Seções da legislação"
        className="container mx-auto px-4 max-w-6xl flex gap-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSwitch(tab.key)}
              className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'text-brand-700 border-brand-600'
                  : 'text-ink-secondary border-transparent hover:text-brand-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 font-normal text-ink-muted">{counts[tab.countKey]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
