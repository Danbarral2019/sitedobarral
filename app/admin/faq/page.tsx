/**
 * FAQ Admin Page (Server Component - Fase 7)
 *
 * Refatorado de Client → Server Component com padrão Hybrid.
 * Layout customizado de cards mantido.
 */

import AdminLayout from '@/components/AdminLayout';
import { fetchFAQsPaginated, getFAQCategories, getFAQStats } from '@/lib/faq';
import { FAQClient } from './FAQClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FAQPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Normalizar searchParams
  const normalizedParams = {
    page: typeof params.page === 'string' ? params.page : undefined,
    pageSize: typeof params.pageSize === 'string' ? params.pageSize : undefined,
    category: typeof params.category === 'string' ? params.category : undefined,
    isPublished: typeof params.isPublished === 'string' ? params.isPublished : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
  };

  // Buscar dados em paralelo
  const [faqs, categories, stats] = await Promise.all([
    fetchFAQsPaginated(normalizedParams),
    getFAQCategories(),
    getFAQStats(),
  ]);

  // ✅ Serializar Dates para evitar erro de hidratação
  const serializedFaqs = {
    ...faqs,
    items: faqs.items.map(faq => ({
      ...faq,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
    })),
  };

  return (
    <AdminLayout>
      <FAQClient initialData={serializedFaqs} categories={categories} stats={stats} />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'FAQ | Admin',
  description: 'Gerenciar perguntas frequentes',
};
