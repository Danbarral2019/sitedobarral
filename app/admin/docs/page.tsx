import { fetchPendingDocumentsPaginated } from '@/lib/documents';
import { prisma } from '@/lib/prisma';
import DocsClient from './DocsClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const getSearchParam = (param: string | string[] | undefined): string | undefined => {
  return typeof param === 'string' ? param : undefined;
};

export default async function DocsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const category = getSearchParam(params.category);
  const period = getSearchParam(params.period) || 'all';
  const pageRaw = parseInt(getSearchParam(params.page) || '1', 10);
  const pageSizeRaw = parseInt(getSearchParam(params.pageSize) || '20', 10);

  const safePage = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const safePageSize = Math.min(100, Math.max(1, isNaN(pageSizeRaw) ? 20 : pageSizeRaw));

  const { items: pendingDocs, total: pendingTotal, page: currentPage, pageSize: currentPageSize, totalPages } =
    await fetchPendingDocumentsPaginated({
      category: category || undefined,
      period: period || undefined,
      page: safePage.toString(),
      pageSize: safePageSize.toString(),
    });

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentUploads = await prisma.document.findMany({
    where: {
      reviewed: true,
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

  const serializedPendingDocs = pendingDocs.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
    douData: doc.douData ? doc.douData.toISOString() : null,
  }));

  const serializedRecentUploads = recentUploads.map(doc => ({
    ...doc,
    uploadedAt: doc.uploadedAt.toISOString(),
  }));

  const defaultTab = getSearchParam(params.tab) || 'central';

  return (
    <DocsClient
      defaultTab={defaultTab}
      pendingDocuments={serializedPendingDocs}
      pendingPagination={{
        total: pendingTotal,
        page: currentPage,
        pageSize: currentPageSize,
        totalPages,
      }}
      recentUploads={serializedRecentUploads}
    />
  );
}

export const metadata = {
  title: 'Documentos | Admin',
  description: 'Central de documentos e gerenciamento',
};
