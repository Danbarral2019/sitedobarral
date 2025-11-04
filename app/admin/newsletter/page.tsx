/**
 * Newsletter Admin Page (Server Component - Fase 7)
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchNewsletterSubscribersPaginated } from '@/lib/newsletter';
import { newsletterConfig, NewsletterHeader } from './config';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewsletterPage({ searchParams }: PageProps) {
  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <NewsletterHeader />
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchNewsletterSubscribersPaginated}
              config={newsletterConfig}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Newsletter | Admin',
  description: 'Gerenciar assinantes da newsletter',
};
