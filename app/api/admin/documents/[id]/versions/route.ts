import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getDocumentHistory } from '@/lib/agu-modules/versioning';

/**
 * GET: Busca histórico de versões de um documento
 */
export const GET = withAdminApi<{ id: string }>(async (request: NextRequest, ctx) => {
  const { id } = ctx.params;

  // Verificar se documento existe
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!document) {
    apiLogger.warn({ documentId: id }, 'Document not found for version history');
    throw new NotFoundError('Documento');
  }

  const versions = await getDocumentHistory(id);

  apiLogger.info({ documentId: id, versionCount: versions.length }, 'Version history fetched');

  return NextResponse.json({
    versions,
    versionCount: versions.length,
  });
});
