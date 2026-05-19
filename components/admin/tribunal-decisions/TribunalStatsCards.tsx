'use client';

import type { TribunalStats } from '@/hooks/use-tribunal-decisions';

interface TribunalStatsCardsProps {
  stats: TribunalStats | null;
  loading: boolean;
}

export function TribunalStatsCards({ stats, loading }: TribunalStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-blue-500">
        <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
        <div className="text-sm text-gray-600">Total de decisoes</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-yellow-500">
        <div className="text-3xl font-bold text-yellow-700">{stats.totalPending}</div>
        <div className="text-sm text-gray-600">Pendentes de revisao</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-green-500">
        <div className="text-3xl font-bold text-green-700">{stats.totalApproved}</div>
        <div className="text-sm text-gray-600">Aprovadas</div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-red-500">
        <div className="text-3xl font-bold text-red-700">{stats.totalRejected}</div>
        <div className="text-sm text-gray-600">Rejeitadas</div>
      </div>
    </div>
  );
}
