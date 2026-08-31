'use client';

import { Scale, Monitor, FileText, Lightbulb } from 'lucide-react';
import type { LegislacaoTab } from '@/lib/legislacao/theme';
import type { TabCounts } from '@/hooks/use-legislacao';

interface TabDef {
  key: LegislacaoTab;
  label: string;
  icon: typeof Scale;
  activeColor: string;
  activeBadge: string;
  hoverText: string;
  countKey: keyof TabCounts;
}

const TABS: TabDef[] = [
  {
    key: 'atos',
    label: 'Atos Normativos',
    icon: Scale,
    activeColor: 'text-brand-700',
    activeBadge: 'bg-brand-100 text-brand-700',
    hoverText: 'hover:text-brand-700',
    countKey: 'atos',
  },
  {
    key: 'tic',
    label: 'Contratações de TIC',
    icon: Monitor,
    activeColor: 'text-brand-700',
    activeBadge: 'bg-brand-100 text-brand-700',
    hoverText: 'hover:text-brand-700',
    countKey: 'tic',
  },
  {
    key: 'boas-praticas',
    label: 'Outros Atos',
    icon: FileText,
    activeColor: 'text-emerald-700',
    activeBadge: 'bg-emerald-100 text-emerald-700',
    hoverText: 'hover:text-emerald-700',
    countKey: 'boasPraticas',
  },
  {
    key: 'orientacoes',
    label: 'Orientações',
    icon: Lightbulb,
    activeColor: 'text-amber-accent-deep',
    activeBadge: 'bg-amber-accent-soft text-amber-accent-deep',
    hoverText: 'hover:text-amber-accent-deep',
    countKey: 'orientacoes',
  },
];

interface LegislacaoTabsProps {
  activeTab: LegislacaoTab;
  counts: TabCounts;
  onSwitch: (tab: LegislacaoTab) => void;
}

export function LegislacaoTabs({ activeTab, counts, onSwitch }: LegislacaoTabsProps) {
  return (
    <section className="container mx-auto px-4 max-w-6xl -mt-6">
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSwitch(tab.key)}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-[6px] font-bold text-sm transition-colors ${
                isActive
                  ? `bg-white ${tab.activeColor} border-2 border-b-0 border-border-subtle`
                  : `bg-white/70 text-ink-muted ${tab.hoverText} hover:bg-white/90 border-2 border-transparent`
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  isActive ? tab.activeBadge : 'bg-surface-deep text-ink-muted'
                }`}
              >
                {counts[tab.countKey]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
