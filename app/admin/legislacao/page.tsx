/**
 * Legislative Acts Admin Page (Server Component - Fix Serialização)
 *
 * Solução para problema de serialização Server/Client:
 * - Server: Busca dados serializáveis (types, issuers, years)
 * - Client: Cria config com funções window.* (LegislacaoClient)
 * - Nunca serializa funções entre fronteiras
 */

import {
  getLegislativeActTypes,
  getLegislativeActIssuers,
  getLegislativeActYears
} from '@/lib/legislacao';
import { LegislacaoClient } from './LegislacaoClient';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LegislacaoPage({ searchParams }: PageProps) {
  // ✅ Server: Buscar apenas dados serializáveis
  const [types, issuers, years] = await Promise.all([
    getLegislativeActTypes(),
    getLegislativeActIssuers(),
    getLegislativeActYears(),
  ]);

  const params = await searchParams;

  // ✅ Client Component cria config com funções
  return (
    <AdminLayout>
      <LegislacaoClient
        types={types}
        issuers={issuers}
        years={years}
        searchParams={params}
      />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Legislação | Admin',
  description: 'Gerenciar atos normativos',
};
