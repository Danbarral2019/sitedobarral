'use client';

/**
 * Videos Client Component (Fix Correto)
 *
 * Padrão correto:
 * - Recebe dados prontos do Server Component (initialData)
 * - Apenas gerencia interações (filtros, navegação)
 * - NUNCA faz data fetching (sem ResourceListContainer)
 */

import { ResourceListClient } from '@/components/admin/ResourceListClient';
import { PaginatedResult } from '@/lib/types/admin-list';
import { CourseVideo } from '@prisma/client';
import { VideosHeader } from './Header';
import { createVideosConfig } from './config';

interface VideosClientProps {
  courses: Array<{ id: string; title: string }>;
  initialData: PaginatedResult<CourseVideo>;
}

export function VideosClient({ courses, initialData }: VideosClientProps) {
  // ✅ Factory chamada NO CLIENTE
  const videosConfig = createVideosConfig({ courses });

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <VideosHeader />
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
          <ResourceListClient
            initialData={initialData}
            config={videosConfig}
          />
        </div>
      </div>
    </div>
  );
}
