import { fetchPendingDocumentsPaginated } from '@/lib/documents';
import { prisma } from '@/lib/prisma';
import AdicionarDocumentosClient from './AdicionarDocumentosClient';
import AdminLayout from '@/components/AdminLayout';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const getSearchParam = (param: string | string[] | undefined): string | undefined => {
  return typeof param === 'string' ? param : undefined;
};

/**
 * Adicionar Documentos - Central de entrada de documentos
 *
 * Combina:
 * 1. Upload de documentos (individual/lote)
 * 2. Criação manual (links/texto)
 * 3. Staging DOU (docs aguardando aprovação)
 * 4. Uploads recentes (últimas 24h)
 */
export default async function AdicionarDocumentosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Extrair filtros para DOU staging
  const category = getSearchParam(params.category);
  const period = getSearchParam(params.period) || 'all';
  const pageRaw = parseInt(getSearchParam(params.page) || '1', 10);
  const pageSizeRaw = parseInt(getSearchParam(params.pageSize) || '20', 10);

  const safePage = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const safePageSize = Math.min(100, Math.max(1, isNaN(pageSizeRaw) ? 20 : pageSizeRaw));

  // Buscar documentos pendentes (DOU staging)
  const { items: pendingDocs, total: pendingTotal, page: currentPage, pageSize: currentPageSize, totalPages } =
    await fetchPendingDocumentsPaginated({
      category: category || undefined,
      period: period || undefined,
      page: safePage.toString(),
      pageSize: safePageSize.toString(),
    });

  // Buscar uploads recentes (últimas 24h)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentUploads = await prisma.document.findMany({
    where: {
      reviewed: true, // Já aprovados
      uploadedAt: { gte: oneDayAgo },
    },
    select: {
      id: true,
      title: true,
      category: true,
      type: true,
      courseId: true,
      isPublic: true,
      uploadedAt: true,
      isCommon: true,
    },
    orderBy: { uploadedAt: 'desc' },
    take: 10,
  });

  // Serializar datas
  const serializedPendingDocs = pendingDocs.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
    douData: doc.douData ? doc.douData.toISOString() : null,
  }));

  const serializedRecentUploads = recentUploads.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
  }));

  return (
    <AdminLayout>
      <AdicionarDocumentosClient
        pendingDocuments={serializedPendingDocs}
        pendingPagination={{
          total: pendingTotal,
          page: currentPage,
          pageSize: currentPageSize,
          totalPages,
        }}
        recentUploads={serializedRecentUploads}
      />
    </AdminLayout>
  );
}

export const metadata = {
  title: 'Adicionar Documentos | Admin',
  description: 'Upload e criação de documentos para os cursos',
};
