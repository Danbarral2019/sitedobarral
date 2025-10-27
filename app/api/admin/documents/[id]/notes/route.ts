import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/documents/[id]/notes
 * Retorna as observações de um documento
 */
export const GET = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        category: true,
        adminNotes: true,
        publicNotes: true,
        notesImportance: true,
        notesRelatedDocs: true,
        notesPracticalUse: true,
        notesKeyPoints: true,
        notesUpdatedAt: true,
        notesUpdatedBy: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Busca documentos relacionados se existirem
    let relatedDocs = [];
    if (document.notesRelatedDocs) {
      try {
        const relatedIds = JSON.parse(document.notesRelatedDocs);
        if (Array.isArray(relatedIds) && relatedIds.length > 0) {
          relatedDocs = await prisma.document.findMany({
            where: { id: { in: relatedIds } },
            select: {
              id: true,
              title: true,
              category: true,
            },
          });
        }
      } catch (e) {
        console.error('Erro ao parsear notesRelatedDocs:', e);
      }
    }

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        relatedDocuments: relatedDocs,
      },
    });

  } catch (error) {
    console.error('[Documents Notes GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar observações' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/documents/[id]/notes
 * Atualiza as observações de um documento
 */
export const PUT = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const body = await request.json();
    const {
      adminNotes,
      publicNotes,
      notesImportance,
      notesRelatedDocs, // Array de IDs
      notesPracticalUse,
      notesKeyPoints,
      adminEmail,
    } = body;

    // Valida importância
    if (notesImportance && !['baixa', 'media', 'alta', 'critica'].includes(notesImportance)) {
      return NextResponse.json(
        { error: 'Importância inválida' },
        { status: 400 }
      );
    }

    // Valida documentos relacionados
    if (notesRelatedDocs && !Array.isArray(notesRelatedDocs)) {
      return NextResponse.json(
        { error: 'notesRelatedDocs deve ser um array' },
        { status: 400 }
      );
    }

    // Atualiza documento
    const updated = await prisma.document.update({
      where: { id },
      data: {
        adminNotes: adminNotes || null,
        publicNotes: publicNotes || null,
        notesImportance: notesImportance || null,
        notesRelatedDocs: notesRelatedDocs ? JSON.stringify(notesRelatedDocs) : null,
        notesPracticalUse: notesPracticalUse || null,
        notesKeyPoints: notesKeyPoints || null,
        notesUpdatedAt: new Date(),
        notesUpdatedBy: adminEmail || null,
      },
      select: {
        id: true,
        title: true,
        adminNotes: true,
        publicNotes: true,
        notesImportance: true,
        notesRelatedDocs: true,
        notesPracticalUse: true,
        notesKeyPoints: true,
        notesUpdatedAt: true,
        notesUpdatedBy: true,
      },
    });

    console.log(`[Documents Notes PUT] Observações atualizadas para documento ${id}`);

    return NextResponse.json({
      success: true,
      document: updated,
    });

  } catch (error) {
    console.error('[Documents Notes PUT] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar observações' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/documents/[id]/notes
 * Remove todas as observações de um documento
 */
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    await prisma.document.update({
      where: { id },
      data: {
        adminNotes: null,
        publicNotes: null,
        notesImportance: null,
        notesRelatedDocs: null,
        notesPracticalUse: null,
        notesKeyPoints: null,
        notesUpdatedAt: null,
        notesUpdatedBy: null,
      },
    });

    console.log(`[Documents Notes DELETE] Observações removidas do documento ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Observações removidas com sucesso',
    });

  } catch (error) {
    console.error('[Documents Notes DELETE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao remover observações' },
      { status: 500 }
    );
  }
});
