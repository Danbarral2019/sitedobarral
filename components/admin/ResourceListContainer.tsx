/**
 * ResourceListContainer - Server Component genérico (Fase 7)
 *
 * Server Component que:
 * 1. Recebe searchParams da URL
 * 2. Chama função de fetch passada via props
 * 3. Renderiza o ResourceListClient com dados
 *
 * Elimina completamente useEffect para data fetching!
 */

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ResourceListClient } from './ResourceListClient';
import { ResourceListContainerProps, ListSearchParams, PaginatedResult } from '@/lib/types/admin-list';

/**
 * Loading Skeleton para Suspense boundary
 */
function ListLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Carregando dados...</p>
      </div>
    </div>
  );
}

/**
 * Normalizar searchParams para ListSearchParams
 */
function normalizeSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}): ListSearchParams {
  const normalized: ListSearchParams = {};

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      // Se for array, pega primeiro valor
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }
  });

  return normalized;
}

/**
 * ResourceListContainer
 */
export async function ResourceListContainer<T extends { id: string }>({
  searchParams,
  fetchData,
  config,
}: ResourceListContainerProps<T>) {
  // Normalizar searchParams
  const params = normalizeSearchParams(searchParams);

  // Aplicar defaults de paginação
  const page = parseInt(params.page || String(config.defaultPage || 1));
  const pageSize = parseInt(params.pageSize || String(config.defaultPageSize || 50));

  // Buscar dados no servidor
  const data: PaginatedResult<T> = await fetchData({
    ...params,
    page: String(page),
    pageSize: String(pageSize),
  });

  // Renderizar Client Component com dados
  return (
    <Suspense fallback={<ListLoadingSkeleton />}>
      <ResourceListClient<T> initialData={data} config={config} />
    </Suspense>
  );
}

/**
 * Função helper para criar configs rapidamente
 */
export function createListConfig<T extends { id: string }>(
  config: Partial<import('@/lib/types/admin-list').AdminListConfig<T>> & {
    title: string;
    columns: import('@/lib/types/admin-list').ColumnConfig<T>[];
  }
): import('@/lib/types/admin-list').AdminListConfig<T> {
  return {
    defaultPage: 1,
    defaultPageSize: 50,
    pageSizeOptions: [10, 25, 50, 100],
    allowSelection: false,
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    showStats: false,
    emptyMessage: 'Nenhum item encontrado',
    ...config,
  };
}
