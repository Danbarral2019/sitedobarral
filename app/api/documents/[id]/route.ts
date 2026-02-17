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
      include: {
        metaTcu: true,
        metaDou: true,
        notes: true,
      },
    });

    if (!document) {
      apiLogger.warn({ documentId }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    apiLogger.info({ documentId }, 'Document fetched successfully');

    // Map satellite table notes back to flat names for frontend compatibility
    const response = {
      ...document,
      adminNotes: document.notes?.adminNotes ?? document.adminNotes,
      publicNotes: document.notes?.publicNotes ?? document.publicNotes,
      keyPoints: document.notes?.keyPoints ?? document.notesKeyPoints,
      practicalUse: document.notes?.practicalUse ?? document.notesPracticalUse,
      importance: document.notes?.importance ?? document.notesImportance,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
