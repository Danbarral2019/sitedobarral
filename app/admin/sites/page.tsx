/**
 * Sites Admin Page (Server Component - Fase 7)
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchSitesPaginated } from '@/lib/sites';
import { sitesConfig, SitesHeader } from './config';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SitesPage({ searchParams }: PageProps) {
  return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <SitesHeader />
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchSitesPaginated}
              config={sitesConfig}
            />
          </div>
        </div>
      </div>
  );
}

export const metadata = {
  title: 'Sites | Admin',
  description: 'Gerenciar sites recomendados',
};
