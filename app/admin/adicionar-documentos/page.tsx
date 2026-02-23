import { prisma } from '@/lib/prisma';
import AdicionarDocumentosClient from './AdicionarDocumentosClient';


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const getSearchParam = (param: string | string[] | undefined): string | undefined => {
  return typeof param === 'string' ? param : undefined;
};

/**
 * Central de Documentos
 *
 * Combina:
 * 1. Upload de documentos (individual/lote)
 * 2. Criação manual (links/texto)
 * 3. Importações automáticas recentes (últimos 7 dias)
 * 4. Uploads recentes (últimas 24h)
 */
export default async function AdicionarDocumentosPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const category = getSearchParam(params.category);
  const pageRaw = parseInt(getSearchParam(params.page) || '1', 10);
  const pageSizeRaw = parseInt(getSearchParam(params.pageSize) || '20', 10);

  const safePage = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const safePageSize = Math.min(100, Math.max(1, isNaN(pageSizeRaw) ? 20 : pageSizeRaw));

  // Buscar documentos auto-importados nos últimos 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const autoImportWhere = {
    reviewedBy: { in: ['auto-sync-tcu', 'auto-migration'] },
    reviewedAt: { gte: sevenDaysAgo },
    ...(category ? { category } : {}),
  };

  const [autoImports, autoImportsTotal] = await Promise.all([
    prisma.document.findMany({
      where: autoImportWhere,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        type: true,
        url: true,
        uploadedAt: true,
        summary: true,
        metaTcu: {
          select: {
            numeroAcordao: true,
          },
        },
        reviewedBy: true,
      },
      orderBy: { uploadedAt: 'desc' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.document.count({ where: autoImportWhere }),
  ]);

  const totalPages = Math.ceil(autoImportsTotal / safePageSize);

  // Buscar uploads recentes (últimas 24h)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentUploads = await prisma.document.findMany({
    where: {
      reviewed: true,
      uploadedAt: { gte: oneDayAgo },
      OR: [
        { reviewedBy: null },
        { reviewedBy: { notIn: ['auto-sync-tcu', 'auto-migration'] } },
      ],
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
  const serializedAutoImports = autoImports.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
  }));

  const serializedRecentUploads = recentUploads.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
  }));

  return (
      <AdicionarDocumentosClient
        autoImports={serializedAutoImports}
        autoImportsPagination={{
          total: autoImportsTotal,
          page: safePage,
          pageSize: safePageSize,
          totalPages,
        }}
        recentUploads={serializedRecentUploads}
      />
  );
}

export const metadata = {
  title: 'Central de Documentos | Admin',
  description: 'Upload, criação e monitoramento de documentos',
};
