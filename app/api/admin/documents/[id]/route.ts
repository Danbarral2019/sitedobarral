import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const parsedDocument = {
      ...document,
      tags: document.tags ? JSON.parse(document.tags) : [],
      leiArticles: document.leiArticles ? JSON.parse(document.leiArticles) : [],
      alternativeUrls: document.alternativeUrls || null,
    };

    return NextResponse.json(parsedDocument);
  } catch (error) {
    console.error('[GET Document] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documento' },
      { status: 500 }
    );
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
    } = body;

    // Verifica se documento existe
    const existing = await prisma.document.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
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
      },
    });

    console.log(`[PUT Document] Documento ${id} atualizado com sucesso`);

    return NextResponse.json({
      success: true,
      document: updated,
    });
  } catch (error) {
    console.error('[PUT Document] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar documento' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
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
    console.error('[PATCH Document] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar documento' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Deleta
    await prisma.document.delete({
      where: { id },
    });

    console.log(`[DELETE Document] Documento ${id} deletado com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Documento deletado com sucesso',
    });
  } catch (error) {
    console.error('[DELETE Document] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar documento' },
      { status: 500 }
    );
  }
});
