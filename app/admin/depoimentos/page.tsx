/**
 * Depoimentos Admin Page (Server Component - Fix Serialização)
 *
 * Solução para problema de serialização Server/Client:
 * - Server Component simples que delega para Client
 * - Client Component importa e usa config com funções
 */

import { DepoimentosClient } from './DepoimentosClient';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepoimentosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <AdminLayout>
      <DepoimentosClient searchParams={params} />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Depoimentos | Admin',
  description: 'Gerenciar depoimentos',
};
