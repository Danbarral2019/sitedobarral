import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

/**
 * GET: Busca um documento por ID
 */
export const GET = withAdminAuth(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      apiLogger.warn({ documentId: id }, 'Document not found');
      throw new NotFoundError('Documento');
    }

    // Parse JSON fields with safe parsing (handles both JSON and CSV formats)
    const parsedDocument = {
      ...document,
      tags: safeParseArray(document.tags),
      leiArticles: safeParseArray(document.leiArticles),
      alternativeUrls: document.alternativeUrls || null,
    };

    return NextResponse.json(parsedDocument);
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PUT: Atualiza um documento
 */
export const PUT = withAdminAuth(async (request: NextRequest, { params }: { params: { id: string } }, context?: { user?: { email?: string } }) => {
  try {
    const { id } = params;
    const body = await request.json();

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
      feedbackData.feedbackGivenBy = context?.user?.email || 'admin';
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
        alternativeUrls: alternativeUrls !== undefined ? alternativeUrls : existing.alternativeUrls,
        courseId: courseId !== undefined ? courseId : existing.courseId,
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
        entityType: entityType !== undefined ? entityType : existing.entityType,
        enunciadoNumber: enunciadoNumber !== undefined ? enunciadoNumber : existing.enunciadoNumber,
      },
    });

    apiLogger.info({ documentId: id }, 'Document updated successfully');

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PATCH: Atualização parcial de um documento (para classificação em lote)
 */
export const PATCH = withAdminAuth(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;
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
    if (body.tags !== undefined) allowedFields.tags = body.tags;
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

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * DELETE: Deleta um documento
 */
export const DELETE = withAdminAuth(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params;

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

    return NextResponse.json({
      success: true,
      message: 'Documento deletado com sucesso',
    });
  } catch (error) {
    return handleApiError(error);
  }
});
