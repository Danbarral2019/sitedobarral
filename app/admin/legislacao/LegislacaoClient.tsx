'use client';

/**
 * Legislacao Client Component (Fix de Serialização)
 *
 * Este componente resolve o problema de serialização Server/Client:
 * - Recebe dados serializáveis do servidor (types, issuers, years)
 * - Chama a factory function NO CLIENTE
 * - O objeto config (com funções window.*) nunca precisa ser serializado
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchLegislativeActsPaginated } from '@/lib/legislacao';
import { LegislacaoHeader } from './Header';
import { createLegislacaoConfig } from './config';

interface LegislacaoClientProps {
  types: string[];
  issuers: string[];
  years: number[];
  searchParams: { [key: string]: string | string[] | undefined };
}

export function LegislacaoClient({ types, issuers, years, searchParams }: LegislacaoClientProps) {
  // ✅ SOLUÇÃO: Factory chamada NO CLIENTE
  // O objeto config (com funções) vive inteiramente no cliente
  const legislacaoConfig = createLegislacaoConfig({ types, issuers, years });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <LegislacaoHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListContainer
            searchParams={searchParams}
            fetchData={fetchLegislativeActsPaginated}
            config={legislacaoConfig}
          />
        </div>
      </div>
    </div>
  );
}
