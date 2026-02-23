/**
 * Legislative Acts Admin Page (Server Component - Fix)
 *
 * Padrão correto:
 * - Server Component busca TODOS os dados (including paginated list)
 * - Passa dados prontos para Client Component
 * - Client apenas gerencia interações (nunca data fetching)
 */

import {
  getLegislativeActTypes,
  getLegislativeActIssuers,
  getLegislativeActYears,
  getLegislativeActStats,
  fetchLegislativeActsPaginated
} from '@/lib/legislacao';
import { LegislacaoClient } from './LegislacaoClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LegislacaoPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Normalizar searchParams
  const normalizedParams = {
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    type: typeof params.type === 'string' ? params.type : undefined,
    issuer: typeof params.issuer === 'string' ? params.issuer : undefined,
    year: typeof params.year === 'string' ? params.year : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  // ✅ Server: Buscar TODOS os dados aqui
  const [types, issuers, years, acts, stats] = await Promise.all([
    getLegislativeActTypes(),
    getLegislativeActIssuers(),
    getLegislativeActYears(),
    fetchLegislativeActsPaginated(normalizedParams),
    getLegislativeActStats(),
  ]);

  // ✅ Passar dados prontos para Client
  return (
      <LegislacaoClient
        initialData={acts}
        types={types}
        issuers={issuers}
        years={years}
        stats={stats}
      />
  );
}

export const metadata = {
  title: 'Legislação | Admin',
  description: 'Gerenciar atos normativos',
};
