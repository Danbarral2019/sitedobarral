/**
 * Depoimentos Admin Page (Server Component - Fase 7)
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchTestimonialsPaginated } from '@/lib/depoimentos';
import { depoimentosConfig, DepoimentosHeader } from './config';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepoimentosPage({ searchParams }: PageProps) {
  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <DepoimentosHeader />
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchTestimonialsPaginated}
              config={depoimentosConfig}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Depoimentos | Admin',
  description: 'Gerenciar depoimentos',
};
