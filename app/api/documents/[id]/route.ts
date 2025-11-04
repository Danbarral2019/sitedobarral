import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      apiLogger.warn({ documentId }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    return NextResponse.json({ document });
  } catch (error) {
    return handleApiError(error);
  }
}
