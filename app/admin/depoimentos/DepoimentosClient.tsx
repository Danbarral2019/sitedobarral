'use client';

/**
 * Depoimentos Client Component (Fix Correto)
 *
 * Padrão correto:
 * - Recebe dados prontos do Server Component (initialData)
 * - Apenas gerencia interações (filtros, navegação)
 * - NUNCA faz data fetching (sem ResourceListContainer)
 */

import { ResourceListClient } from '@/components/admin/ResourceListClient';
import { PaginatedResult } from '@/lib/types/admin-list';
import { Testimonial } from '@prisma/client';
import { depoimentosConfig, DepoimentosHeader } from './config';

interface DepoimentosClientProps {
  initialData: PaginatedResult<Testimonial>;
}

export function DepoimentosClient({ initialData }: DepoimentosClientProps) {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <DepoimentosHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListClient
            initialData={initialData}
            config={depoimentosConfig}
          />
        </div>
      </div>
    </div>
  );
}
