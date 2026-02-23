/**
 * Publications Admin Page (Server Component - Fase 7)
 *
 * Refatorado de Client → Server Component com padrão Hybrid.
 * Performance: TTI melhorado, elimina useEffect para data fetching.
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchPublicationsPaginated } from '@/lib/publications';
import { publicationsConfig, PublicationsHeader } from './config';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PublicationsPage({ searchParams }: PageProps) {
  return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header customizado com botões */}
          <PublicationsHeader />

          {/* Lista genérica */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchPublicationsPaginated}
              config={publicationsConfig}
            />
          </div>
        </div>
      </div>
  );
}

export const metadata = {
  title: 'Publicações | Admin',
  description: 'Gerenciar publicações acadêmicas',
};
