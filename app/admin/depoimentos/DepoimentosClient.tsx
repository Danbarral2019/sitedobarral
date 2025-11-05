'use client';

/**
 * Depoimentos Client Component (Fix de Serialização)
 *
 * Este componente resolve o problema de serialização Server/Client:
 * - O objeto config (com funções window.*) é criado e vive no cliente
 * - Nunca precisa ser serializado entre fronteiras
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchTestimonialsPaginated } from '@/lib/depoimentos';
import { depoimentosConfig, DepoimentosHeader } from './config';

interface DepoimentosClientProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export function DepoimentosClient({ searchParams }: DepoimentosClientProps) {
  // ✅ Config já está no arquivo 'use client', mas importamos no cliente
  // para garantir que o objeto vive inteiramente no ambiente do cliente

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <DepoimentosHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListContainer
            searchParams={searchParams}
            fetchData={fetchTestimonialsPaginated}
            config={depoimentosConfig}
          />
        </div>
      </div>
    </div>
  );
}
