import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, AuthorizationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { LinkLessonDocumentSchema } from '@/lib/validation-schemas';

/**
 * POST: Vincula um documento a uma lição
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { id: lessonId } = await params;
    const body = await request.json();
    const data = LinkLessonDocumentSchema.parse(body);

    // Verificar se a lição existe
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundError('Lição');
    }

    // Verificar se o documento existe
    const document = await prisma.document.findUnique({ where: { id: data.documentId } });
    if (!document) {
      throw new NotFoundError('Documento');
    }

    // Auto-set displayOrder se não fornecido
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await prisma.lessonDocument.aggregate({
        where: { lessonId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    const lessonDocument = await prisma.lessonDocument.create({
      data: {
        lessonId,
        documentId: data.documentId,
        displayOrder,
        isRequired: data.isRequired ?? false,
        note: data.note,
      },
      include: { document: true },
    });

    apiLogger.info({ lessonId, documentId: data.documentId }, 'Document linked to lesson');
    return NextResponse.json({ lessonDocument }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove vínculo de documento de uma lição
 * Query param: documentId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { id: lessonId } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId é obrigatório' },
        { status: 400 }
      );
    }

    const existing = await prisma.lessonDocument.findUnique({
      where: { lessonId_documentId: { lessonId, documentId } },
    });
    if (!existing) {
      throw new NotFoundError('Vínculo documento-lição');
    }

    await prisma.lessonDocument.delete({
      where: { lessonId_documentId: { lessonId, documentId } },
    });

    apiLogger.info({ lessonId, documentId }, 'Document unlinked from lesson');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
