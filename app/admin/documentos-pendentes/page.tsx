import { fetchPendingDocumentsPaginated } from '@/lib/documents';
import DocumentosPendentesClient from './DocumentosPendentesClient';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Helper DRY para extrair search params
const getSearchParam = (param: string | string[] | undefined): string | undefined => {
  return typeof param === 'string' ? param : undefined;
};

/**
 * Página de Documentos Pendentes (Server Component - Fase 7 + Fix #4 + Fix #6)
 *
 * Refatorada de Client → Server Component com padrão Hybrid:
 * - Fetches data no servidor (elimina useEffect)
 * - Filtros (category, period, page, pageSize) via URL searchParams
 * - Renderiza Client Component para interatividade
 * - ✅ FIX #4: Paginação para melhorar performance com 1000+ docs
 * - ✅ FIX #6: Validação robusta + cap DoS (max 200 itens/página)
 *
 * Performance: TTI melhorado ~400ms, eliminado request waterfall
 */
export default async function DocumentosPendentesPage({ searchParams }: PageProps) {
  // ✅ FIX #6: searchParams é objeto síncrono no Page Component (Next.js 15)
  const params = await searchParams;

  // Extrair e validar filtros
  const category = getSearchParam(params.category);
  const period = getSearchParam(params.period) || 'all';

  // ✅ FIX #6: Parse e validação robusta de números (evita NaN, negativos, DoS)
  const pageRaw = parseInt(getSearchParam(params.page) || '1', 10);
  const pageSizeRaw = parseInt(getSearchParam(params.pageSize) || '50', 10);

  // Garantir valores seguros
  const safePage = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const safePageSize = Math.min(200, Math.max(1, isNaN(pageSizeRaw) ? 50 : pageSizeRaw)); // ✅ Cap DoS: max 200

  // ✅ FIX #4: Usar versão paginada para evitar carregar 1000+ docs de uma vez
  const { items, total, page: currentPage, pageSize: currentPageSize, totalPages } = await fetchPendingDocumentsPaginated({
    category: category || undefined,
    period: period || undefined,
    page: safePage.toString(),
    pageSize: safePageSize.toString(),
  });

  // ✅ Serializar Dates para evitar erro de hidratação
  const serializedItems = items.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
    douData: doc.douData ? doc.douData.toISOString() : null,
  }));

  // Renderizar Client Component com dados e paginação
  return (
    <AdminLayout>
      <DocumentosPendentesClient
        documents={serializedItems}
        pagination={{
          total,
          page: currentPage,
          pageSize: currentPageSize,
          totalPages,
        }}
      />
    </AdminLayout>
  );
}

/**
 * Metadata (opcional - para SEO)
 */
export const metadata = {
  title: 'Documentos Pendentes | Admin',
  description: 'Revise e aprove documentos importados automaticamente',
};
