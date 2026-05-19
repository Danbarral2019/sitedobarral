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
    activeColor: 'text-blue-700',
    activeBadge: 'bg-blue-100 text-blue-700',
    hoverText: 'hover:text-blue-700',
    countKey: 'atos',
  },
  {
    key: 'tic',
    label: 'Contratações de TIC',
    icon: Monitor,
    activeColor: 'text-cyan-700',
    activeBadge: 'bg-cyan-100 text-cyan-700',
    hoverText: 'hover:text-cyan-700',
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
    activeColor: 'text-amber-700',
    activeBadge: 'bg-amber-100 text-amber-700',
    hoverText: 'hover:text-amber-700',
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
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${
                isActive
                  ? `bg-white ${tab.activeColor} border-2 border-b-0 border-gray-200 shadow-sm`
                  : `bg-white/70 text-gray-600 ${tab.hoverText} hover:bg-white/90 border-2 border-transparent`
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  isActive ? tab.activeBadge : 'bg-gray-100 text-gray-600'
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
