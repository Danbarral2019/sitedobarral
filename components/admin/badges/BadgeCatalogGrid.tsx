'use client';

import { Sparkles, Hand, Trophy } from 'lucide-react';
import type { BadgeCatalogEntry } from '@/hooks/use-badges-admin';

interface Props {
  catalog: BadgeCatalogEntry[];
  total: number;
  filterType: string;
  onFilter: (type: string) => void;
}

export function BadgeCatalogGrid({ catalog, total, filterType, onFilter }: Props) {
  const auto = catalog.filter((c) => c.award === 'auto');
  const manual = catalog.filter((c) => c.award === 'manual');

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600" />
          <h2 className="text-xl font-bold text-gray-900">Catálogo de badges</h2>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            <strong className="text-gray-900">{total}</strong> badge{total === 1 ? '' : 's'} concedido{total === 1 ? '' : 's'}
          </span>
          {filterType && (
            <button
              onClick={() => onFilter('')}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
      </div>

      <Section
        title="Automáticos"
        icon={<Sparkles className="w-4 h-4 text-blue-500" />}
        description="Concedidos pelo sistema quando eventos disparam (aulas, quizzes, streaks)"
        items={auto}
        filterType={filterType}
        onFilter={onFilter}
      />

      <Section
        title="Manuais"
        icon={<Hand className="w-4 h-4 text-purple-500" />}
        description="Concedidos pelo admin para reconhecer contribuições especiais"
        items={manual}
        filterType={filterType}
        onFilter={onFilter}
      />
    </div>
  );
}

function Section({
  title,
  icon,
  description,
  items,
  filterType,
  onFilter,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  items: BadgeCatalogEntry[];
  filterType: string;
  onFilter: (type: string) => void;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">— {description}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => {
          const active = filterType === b.type;
          return (
            <button
              key={b.type}
              onClick={() => onFilter(active ? '' : b.type)}
              className={`text-left p-3 rounded-lg border transition-all ${
                active
                  ? 'border-amber-500 bg-amber-50 shadow-inner'
                  : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl flex-shrink-0">{b.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.label}</p>
                  <p className="text-xs text-gray-500 truncate">{b.description}</p>
                  <p className="text-xs font-mono text-gray-400 mt-1">{b.count} concedido{b.count === 1 ? '' : 's'}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
