import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { CacheInvalidation } from '@/lib/cache/redis-client';

/**
 * GET: Busca um documento por ID
 */
export const GET = withAdminAuth(async (request: NextRequest, context: { params: Promise<{ id: string }>; user?: { id: string; email: string; role: string } }) => {
  try {
    const { id } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { metaTcu: true, metaDou: true, notes: true },
    });

    if (!document) {
      apiLogger.warn({ documentId: id }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    // Parse JSON fields with safe parsing (handles both JSON and CSV formats)
    // Map notes satellite fields back to flat names for frontend compatibility
    const parsedDocument = {
      ...document,
      tags: safeParseArray(document.tags),
      leiArticles: safeParseArray(document.leiArticles),
      alternativeUrls: document.alternativeUrls || null,
      // Prefer satellite table values, fall back to flat fields
      adminNotes: document.notes?.adminNotes ?? document.adminNotes,
      publicNotes: document.notes?.publicNotes ?? document.publicNotes,
      keyPoints: document.notes?.keyPoints ?? document.notesKeyPoints,
      practicalUse: document.notes?.practicalUse ?? document.notesPracticalUse,
      importance: document.notes?.importance ?? document.notesImportance,
    };

    return NextResponse.json(parsedDocument);
  } catch (error) {
    apiLogger.error('=== [DOCUMENT ROUTE] ERRO CAPTURADO ===');
    apiLogger.error({ err: error }, 'Erro completo:');
    apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
    apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
    apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
    apiLogger.error('======================================');
    return handleApiError(error);
  }
});

/**
 * PUT: Atualiza um documento
 */
export const PUT = withAdminAuth(async (request: NextRequest, context: { params: Promise<{ id: string }>; user?: { id: string; email: string; role: string } }) => {
  try {
    console.log('[DOCUMENT PUT DEBUG] Context recebido:', context);
    const { id } = await context.params;
    console.log('[DOCUMENT PUT DEBUG] Document ID:', id);
    const body = await request.json();
    console.log('[DOCUMENT PUT DEBUG] Body recebido (primeiras 500 chars):', JSON.stringify(body).substring(0, 500));

    const {
      title,
      description,
      content, // Conteúdo para busca textual
      url,
      type,
      category,
      isPublic,
      tags,
      leiArticles,
      alternativeUrls, // Links/arquivos adicionais
      courseId,
      isCommon,
      // Feedback de IA/ML (Fase 3D)
      feedbackRelevance,
      feedbackReasoning,
      // Resumo Automático com IA
      summary,
      summaryEditedByAdmin,
      // Enunciados
      entityType,
      enunciadoNumber,
      // Observações (mapeadas dos campos do frontend)
      keyPoints,      // Frontend envia keyPoints → mapeamos para notesKeyPoints
      practicalUse,   // Frontend envia practicalUse → mapeamos para notesPracticalUse
      importance,     // Frontend envia importance → mapeamos para notesImportance
      adminNotes,
      publicNotes,
    } = body;

    // Verifica se documento existe
    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      apiLogger.warn({ documentId: id }, 'Document not found for update/patch');
      throw new NotFoundError('Documento');
    }

    // Prepara dados de feedback se fornecidos
    const feedbackData: Record<string, unknown> = {};
    if (feedbackRelevance !== undefined) {
      feedbackData.feedbackRelevance = feedbackRelevance;
      feedbackData.feedbackGivenAt = new Date();
      feedbackData.feedbackGivenBy = context.user?.email || 'admin';
    }
    if (feedbackReasoning !== undefined) {
      feedbackData.feedbackReasoning = feedbackReasoning;
    }

    // Atualiza documento e marca como revisado
    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: title || existing.title,
        description: description !== undefined ? description : existing.description,
        content: content !== undefined ? content : existing.content, // Conteúdo para busca textual
        url: url || existing.url,
        type: type || existing.type,
        category: category || existing.category,
        isPublic: isPublic !== undefined ? isPublic : existing.isPublic,
        tags: tags ? JSON.stringify(tags) : existing.tags,
        leiArticles: leiArticles ? JSON.stringify(leiArticles) : existing.leiArticles,
        alternativeUrls: alternativeUrls !== undefined
          ? (Array.isArray(alternativeUrls) ? JSON.stringify(alternativeUrls) : alternativeUrls)
          : existing.alternativeUrls,
        courseId: courseId !== undefined ? (courseId === '' ? null : courseId) : existing.courseId,
        isCommon: isCommon !== undefined ? isCommon : existing.isCommon,
        // Marca como revisado quando editado por um admin
        reviewed: true,
        reviewedAt: new Date(),
        // Feedback de IA/ML (Fase 3D)
        ...feedbackData,
        // Resumo Automático com IA
        summary: summary !== undefined ? summary : existing.summary,
        summaryEditedByAdmin: summaryEditedByAdmin !== undefined ? summaryEditedByAdmin : existing.summaryEditedByAdmin,
        // Enunciados
        entityType: entityType !== undefined ? (entityType === '' ? null : entityType) : existing.entityType,
        enunciadoNumber: enunciadoNumber !== undefined ? (enunciadoNumber === '' ? null : enunciadoNumber) : existing.enunciadoNumber,
        // Observações flat fields (legado, mantido durante transição)
        notesKeyPoints: keyPoints !== undefined ? (keyPoints === '' ? null : keyPoints) : existing.notesKeyPoints,
        notesPracticalUse: practicalUse !== undefined ? (practicalUse === '' ? null : practicalUse) : existing.notesPracticalUse,
        notesImportance: importance !== undefined ? (importance === '' ? null : importance) : existing.notesImportance,
        adminNotes: adminNotes !== undefined ? (adminNotes === '' ? null : adminNotes) : existing.adminNotes,
        publicNotes: publicNotes !== undefined ? (publicNotes === '' ? null : publicNotes) : existing.publicNotes,
        notesUpdatedAt: new Date(),
        notesUpdatedBy: context.user?.email || 'admin',
        // Satellite table (dual-write)
        notes: {
          upsert: {
            create: {
              keyPoints: keyPoints !== undefined ? (keyPoints === '' ? null : keyPoints) : existing.notesKeyPoints,
              practicalUse: practicalUse !== undefined ? (practicalUse === '' ? null : practicalUse) : existing.notesPracticalUse,
              importance: importance !== undefined ? (importance === '' ? null : importance) : existing.notesImportance,
              adminNotes: adminNotes !== undefined ? (adminNotes === '' ? null : adminNotes) : existing.adminNotes,
              publicNotes: publicNotes !== undefined ? (publicNotes === '' ? null : publicNotes) : existing.publicNotes,
              updatedAt: new Date(),
              updatedBy: context.user?.email || 'admin',
            },
            update: {
              keyPoints: keyPoints !== undefined ? (keyPoints === '' ? null : keyPoints) : undefined,
              practicalUse: practicalUse !== undefined ? (practicalUse === '' ? null : practicalUse) : undefined,
              importance: importance !== undefined ? (importance === '' ? null : importance) : undefined,
              adminNotes: adminNotes !== undefined ? (adminNotes === '' ? null : adminNotes) : undefined,
              publicNotes: publicNotes !== undefined ? (publicNotes === '' ? null : publicNotes) : undefined,
              updatedAt: new Date(),
              updatedBy: context.user?.email || 'admin',
            },
          },
        },
      },
    });

    apiLogger.info({ documentId: id }, 'Document updated successfully');

    // Invalidate caches - documents + lei articles (if leiArticles changed)
    await CacheInvalidation.courseDocuments(updated.courseId || undefined);
    if (leiArticles !== undefined) {
      await CacheInvalidation.leiArticles();
    }

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error) {
    apiLogger.error('=== [DOCUMENT ROUTE] ERRO CAPTURADO ===');
    apiLogger.error({ err: error }, 'Erro completo:');
    apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
    apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
    apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
    apiLogger.error('======================================');
    return handleApiError(error);
  }
});

/**
 * PATCH: Atualização parcial de um documento (para classificação em lote)
 */
export const PATCH = withAdminAuth(async (request: NextRequest, context: { params: Promise<{ id: string }>; user?: { id: string; email: string; role: string } }) => {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Verifica se documento existe
    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      apiLogger.warn({ documentId: id }, 'Document not found for update/patch');
      throw new NotFoundError('Documento');
    }

    // Campos permitidos para atualização parcial
    const allowedFields: Record<string, unknown> = {};

    if (body.courseId !== undefined) allowedFields.courseId = body.courseId;
    if (body.category !== undefined) allowedFields.category = body.category;
    if (body.tags !== undefined) allowedFields.tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags;
    if (body.leiArticles !== undefined) allowedFields.leiArticles = JSON.stringify(body.leiArticles);
    if (body.isPublic !== undefined) allowedFields.isPublic = body.isPublic;
    if (body.reviewed !== undefined) {
      allowedFields.reviewed = body.reviewed;
      if (body.reviewed === true) {
        allowedFields.reviewedAt = new Date();
      }
    }

    // Atualiza documento
    const updated = await prisma.document.update({
      where: { id },
      data: allowedFields,
    });

    // Invalidate caches - documents (if course changed, invalidate both old and new)
    if (body.courseId !== undefined && body.courseId !== existing.courseId) {
      if (existing.courseId) {
        await CacheInvalidation.courseDocuments(existing.courseId);
      }
      if (body.courseId) {
        await CacheInvalidation.courseDocuments(body.courseId);
      }
    } else if (existing.courseId) {
      await CacheInvalidation.courseDocuments(existing.courseId);
    }
    if (body.leiArticles !== undefined) {
      await CacheInvalidation.leiArticles();
    }

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error) {
    apiLogger.error('=== [DOCUMENT ROUTE] ERRO CAPTURADO ===');
    apiLogger.error({ err: error }, 'Erro completo:');
    apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
    apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
    apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
    apiLogger.error('======================================');
    return handleApiError(error);
  }
});

/**
 * DELETE: Deleta um documento
 */
export const DELETE = withAdminAuth(async (request: NextRequest, context: { params: Promise<{ id: string }>; user?: { id: string; email: string; role: string } }) => {
  try {
    const { id } = await context.params;

    // Verifica se existe
    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      apiLogger.warn({ documentId: id }, 'Document not found for deletion');
      throw new NotFoundError('Documento');
    }

    // Deleta
    await prisma.document.delete({
      where: { id },
    });

    apiLogger.info({ documentId: id, title: existing.title }, 'Document deleted successfully');

    // Invalidate caches - documents + lei articles
    if (existing.courseId) {
      await CacheInvalidation.courseDocuments(existing.courseId);
    }
    // If document had leiArticles, invalidate that cache too
    if (existing.leiArticles) {
      await CacheInvalidation.leiArticles();
    }

    return NextResponse.json({
      success: true,
      message: 'Documento deletado com sucesso',
    });
  } catch (error) {
    apiLogger.error('=== [DOCUMENT ROUTE] ERRO CAPTURADO ===');
    apiLogger.error({ err: error }, 'Erro completo:');
    apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
    apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
    apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
    apiLogger.error('======================================');
    return handleApiError(error);
  }
});
