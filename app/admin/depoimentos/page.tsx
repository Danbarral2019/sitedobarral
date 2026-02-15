/**
 * Depoimentos Admin Page (Server Component - Fix Correto)
 *
 * Padrão correto:
 * - Server Component busca TODOS os dados (including paginated list)
 * - Passa dados prontos para Client Component
 * - Client apenas gerencia interações (nunca data fetching)
 */

import { DepoimentosClient } from './DepoimentosClient';
import AdminLayout from '@/components/AdminLayout';
import { fetchTestimonialsPaginated } from '@/lib/depoimentos';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepoimentosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Normalizar searchParams
  const normalizedParams = {
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    isPublished: typeof params.isPublished === 'string' ? params.isPublished : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  // ✅ Server: Buscar TODOS os dados aqui
  const testimonials = await fetchTestimonialsPaginated(normalizedParams);

  // ✅ Serializar Dates para evitar erro de hidratação
  const serializedTestimonials = {
    ...testimonials,
    items: testimonials.items.map(t => ({
      ...t,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    })),
  };

  // ✅ Passar dados prontos para Client
  return (
    <AdminLayout>
      <DepoimentosClient initialData={serializedTestimonials as typeof testimonials} />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Depoimentos | Admin',
  description: 'Gerenciar depoimentos',
};
