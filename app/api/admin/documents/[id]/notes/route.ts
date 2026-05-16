import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/documents/[id]/notes
 * Retorna as observações de um documento (via tabela satélite DocumentNotes)
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
        notes: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Busca documentos relacionados se existirem
    let relatedDocs: { id: string; title: string; category: string }[] = [];
    const relatedDocsStr = document.notes?.relatedDocs;
    if (relatedDocsStr) {
      try {
        const relatedIds = JSON.parse(relatedDocsStr);
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
        apiLogger.error({ err: e }, 'Erro ao parsear relatedDocs:');
      }
    }

    // Retorna no formato esperado pelo frontend (compatível)
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        adminNotes: document.notes?.adminNotes ?? null,
        publicNotes: document.notes?.publicNotes ?? null,
        notesImportance: document.notes?.importance ?? null,
        notesRelatedDocs: document.notes?.relatedDocs ?? null,
        notesPracticalUse: document.notes?.practicalUse ?? null,
        notesKeyPoints: document.notes?.keyPoints ?? null,
        notesUpdatedAt: document.notes?.updatedAt ?? null,
        notesUpdatedBy: document.notes?.updatedBy ?? null,
        relatedDocuments: relatedDocs,
      },
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Documents Notes GET] Erro:');
    return NextResponse.json(
      { error: 'Erro ao buscar observações' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/admin/documents/[id]/notes
 * Atualiza as observações de um documento (dual-write: satellite + flat fields)
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

    const notesData = {
      adminNotes: adminNotes || null,
      publicNotes: publicNotes || null,
      importance: notesImportance || null,
      relatedDocs: notesRelatedDocs ? JSON.stringify(notesRelatedDocs) : null,
      practicalUse: notesPracticalUse || null,
      keyPoints: notesKeyPoints || null,
      updatedAt: new Date(),
      updatedBy: adminEmail || null,
    };

    // Dual-write: satellite table + flat fields
    const updated = await prisma.document.update({
      where: { id },
      data: {
        // Flat fields (legado, mantido durante transição)
        adminNotes: adminNotes || null,
        publicNotes: publicNotes || null,
        notesImportance: notesImportance || null,
        notesRelatedDocs: notesRelatedDocs ? JSON.stringify(notesRelatedDocs) : null,
        notesPracticalUse: notesPracticalUse || null,
        notesKeyPoints: notesKeyPoints || null,
        notesUpdatedAt: new Date(),
        notesUpdatedBy: adminEmail || null,
        // Satellite table (upsert: cria se não existe, atualiza se existe)
        notes: {
          upsert: {
            create: notesData,
            update: notesData,
          },
        },
      },
      select: {
        id: true,
        title: true,
        notes: true,
      },
    });

    console.log(`[Documents Notes PUT] Observações atualizadas para documento ${id}`);

    // Retorna no formato compatível com o frontend
    return NextResponse.json({
      success: true,
      document: {
        id: updated.id,
        title: updated.title,
        adminNotes: updated.notes?.adminNotes ?? null,
        publicNotes: updated.notes?.publicNotes ?? null,
        notesImportance: updated.notes?.importance ?? null,
        notesRelatedDocs: updated.notes?.relatedDocs ?? null,
        notesPracticalUse: updated.notes?.practicalUse ?? null,
        notesKeyPoints: updated.notes?.keyPoints ?? null,
        notesUpdatedAt: updated.notes?.updatedAt ?? null,
        notesUpdatedBy: updated.notes?.updatedBy ?? null,
      },
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Documents Notes PUT] Erro:');
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

    // Dual-write: limpa flat fields + deleta satellite record
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

    // Deleta o registro satélite (se existir)
    await prisma.documentNotes.deleteMany({
      where: { documentId: id },
    });

    console.log(`[Documents Notes DELETE] Observações removidas do documento ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Observações removidas com sucesso',
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Documents Notes DELETE] Erro:');
    return NextResponse.json(
      { error: 'Erro ao remover observações' },
      { status: 500 }
    );
  }
});
