'use client';

/**
 * Legislacao Client Component (Fix Correto)
 *
 * Padrão correto:
 * - Recebe dados prontos do Server Component (initialData)
 * - Apenas gerencia interações (filtros, navegação)
 * - NUNCA faz data fetching (sem ResourceListContainer)
 */

import { ResourceListClient } from '@/components/admin/ResourceListClient';
import { PaginatedResult } from '@/lib/types/admin-list';
import { LegislativeAct, LegislativeActStats } from '@/lib/legislacao';
import { LegislacaoHeader } from './Header';
import { createLegislacaoConfig } from './config';

interface LegislacaoClientProps {
  initialData: PaginatedResult<LegislativeAct>;
  types: string[];
  issuers: string[];
  years: number[];
  stats: LegislativeActStats;
}

export function LegislacaoClient({ initialData, types, issuers, years, stats }: LegislacaoClientProps) {
  // ✅ Factory chamada NO CLIENTE com stats agregadas
  const legislacaoConfig = createLegislacaoConfig({ types, issuers, years, stats });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <LegislacaoHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListClient
            initialData={initialData}
            config={legislacaoConfig}
          />
        </div>
      </div>
    </div>
  );
}
