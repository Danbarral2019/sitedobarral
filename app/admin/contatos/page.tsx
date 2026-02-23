/**
 * Contatos Admin Page (Server Component - Fase 7)
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchContactFormsPaginated } from '@/lib/contatos';
import { contatosConfig, ContatosHeader } from './config';


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContatosPage({ searchParams }: PageProps) {
  return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <ContatosHeader />
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchContactFormsPaginated}
              config={contatosConfig}
            />
          </div>
        </div>
      </div>
  );
}

export const metadata = {
  title: 'Contatos | Admin',
  description: 'Gerenciar mensagens de contato',
};
