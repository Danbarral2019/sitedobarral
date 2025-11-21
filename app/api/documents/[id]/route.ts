import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      apiLogger.warn({ documentId }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    apiLogger.info({ documentId }, 'Document fetched successfully');
    return NextResponse.json(document);
  } catch (error) {
    return handleApiError(error);
  }
}
