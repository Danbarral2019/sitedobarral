/**
 * Legislative Acts Admin Page (Server Component - Fase 7)
 *
 * Refatorado de Client → Server Component com padrão Hybrid.
 * Performance: TTI melhorado, elimina useEffect para data fetching.
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import {
  fetchLegislativeActsPaginated,
  getLegislativeActTypes,
  getLegislativeActIssuers,
  getLegislativeActYears
} from '@/lib/legislacao';
import { createLegislacaoConfig, LegislacaoHeader } from './config';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LegislacaoPage({ searchParams }: PageProps) {
  // Buscar dados em paralelo
  const [types, issuers, years] = await Promise.all([
    getLegislativeActTypes(),
    getLegislativeActIssuers(),
    getLegislativeActYears(),
  ]);

  // Criar config com filtros dinâmicos
  const legislacaoConfig = createLegislacaoConfig({ types, issuers, years });

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header customizado com botões */}
          <LegislacaoHeader />

          {/* Lista genérica */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchLegislativeActsPaginated}
              config={legislacaoConfig}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Legislação | Admin',
  description: 'Gerenciar atos normativos',
};
