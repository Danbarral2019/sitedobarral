'use client';

/**
 * Videos Client Component (Fix de Serialização)
 *
 * Este componente resolve o problema de serialização Server/Client:
 * - Recebe dados serializáveis do servidor (courses list)
 * - Chama a factory function NO CLIENTE
 * - O objeto config (com funções window.*) nunca precisa ser serializado
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchCourseVideosPaginated } from '@/lib/videos';
import { VideosHeader } from './Header';
import { createVideosConfig } from './config';

interface VideosClientProps {
  courses: Array<{ id: string; title: string }>;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function VideosClient({ courses, searchParams }: VideosClientProps) {
  // ✅ SOLUÇÃO: Factory chamada NO CLIENTE
  // O objeto config (com funções) vive inteiramente no cliente
  const videosConfig = createVideosConfig({ courses });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <VideosHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListContainer
            searchParams={searchParams}
            fetchData={fetchCourseVideosPaginated}
            config={videosConfig}
          />
        </div>
      </div>
    </div>
  );
}
