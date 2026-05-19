'use client';

import type { DOUStagingStats } from '@/hooks/use-dou-filtros';

interface DOUStatsDashboardProps {
  stats: DOUStagingStats;
}

const CARDS: Array<{ label: string; key: keyof DOUStagingStats; border: string; text: string }> = [
  { label: 'Total Staging', key: 'totalStaging', border: 'border-l-blue-500', text: 'text-blue-700' },
  { label: 'Pendentes', key: 'pending', border: 'border-l-yellow-500', text: 'text-yellow-700' },
  { label: 'Auto-aprovados', key: 'autoApproved', border: 'border-l-green-500', text: 'text-green-700' },
  { label: 'Aprovados (mes)', key: 'approvedThisMonth', border: 'border-l-emerald-500', text: 'text-emerald-700' },
  { label: 'Rejeitados (mes)', key: 'rejectedThisMonth', border: 'border-l-red-500', text: 'text-red-700' },
  { label: 'Importados', key: 'importedTotal', border: 'border-l-purple-500', text: 'text-purple-700' },
];

export function DOUStatsDashboard({ stats }: DOUStatsDashboardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {CARDS.map((c) => (
        <div key={c.key} className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${c.border}`}>
          <div className={`text-2xl font-bold ${c.text}`}>{stats[c.key]}</div>
          <div className="text-xs text-gray-600">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
