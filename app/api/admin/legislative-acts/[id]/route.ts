import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, ConflictError, NotFoundError } from '@/lib/errors/api-error';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';
import { stringifyLeiArticles } from '@/lib/lei-articles';

/**
 * GET /api/admin/legislative-acts/[id]
 * Busca um ato normativo específico por ID
 */
export const GET = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  const act = await prisma.legislativeAct.findUnique({
    where: { id }
  });

  if (!act) {
    throw new NotFoundError('Ato normativo');
  }

  return NextResponse.json({ act });
});

/**
 * PUT /api/admin/legislative-acts/[id]
 * Atualiza um ato normativo existente
 */
export const PUT = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;
  const body = await request.json();

  // Verificar se o ato existe
  const existing = await prisma.legislativeAct.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Ato normativo');
  }

  // Normalizar campos de texto que vão pra DB (idempotente — passar pelo
  // pipeline garante NBSP/zero-width/boilerplate residual nunca entra).
  const normalizedEmenta = body.ementa !== undefined ? normalizeScrapedText(body.ementa as string) : undefined;
  const normalizedContent = body.content !== undefined ? (body.content ? normalizeScrapedText(body.content as string) : null) : undefined;

  // Validar formatação ANTES do save quando ementa, content, title, year
  // ou publishDate foram passados.
  const willTouchValidatedFields =
    normalizedEmenta !== undefined ||
    normalizedContent !== undefined ||
    body.title !== undefined ||
    body.year !== undefined ||
    body.publishDate !== undefined;
  if (willTouchValidatedFields) {
    const validation = validateActContent({
      url: body.officialUrl ?? existing.officialUrl,
      content: normalizedContent ?? existing.content ?? '',
      ementa: normalizedEmenta ?? existing.ementa,
      title: body.title ?? existing.title,
      year: body.year !== undefined ? parseInt(body.year) : existing.year,
      publishDate: body.publishDate !== undefined ? new Date(body.publishDate) : existing.publishDate,
    });
    if (!validation.ok) {
      throw new ApiError(422, 'Validação de formatação falhou', 'VALIDATION_ERROR', {
        details: validation.errors,
        warnings: validation.warnings,
      });
    }
  }

  // Construir dados de atualização
  const updateData: Record<string, unknown> = {};

  if (body.type !== undefined) updateData.type = body.type;
  if (body.number !== undefined) updateData.number = body.number;
  if (body.year !== undefined) updateData.year = parseInt(body.year);
  if (body.fullNumber !== undefined) updateData.fullNumber = body.fullNumber;
  if (body.title !== undefined) updateData.title = body.title;
  if (normalizedEmenta !== undefined) updateData.ementa = normalizedEmenta;
  if (body.summary !== undefined) updateData.summary = body.summary || null;
  if (body.issuer !== undefined) updateData.issuer = body.issuer;
  if (body.publishDate !== undefined) updateData.publishDate = new Date(body.publishDate);
  if (body.effectiveDate !== undefined) {
    updateData.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
  }
  if (body.hierarchyLevel !== undefined) updateData.hierarchyLevel = body.hierarchyLevel;
  if (body.leiArticles !== undefined) {
    updateData.leiArticles = body.leiArticles ? stringifyLeiArticles(body.leiArticles) : null;
  }
  if (body.officialUrl !== undefined) updateData.officialUrl = body.officialUrl || null;
  if (body.pdfUrl !== undefined) updateData.pdfUrl = body.pdfUrl || null;
  if (normalizedContent !== undefined) updateData.content = normalizedContent;
  if (body.importance !== undefined) {
    // Aceita 'baixa' | 'media' | 'alta' | 'critica' ou null/string vazia para limpar
    const allowed = ['baixa', 'media', 'alta', 'critica'];
    updateData.importance = allowed.includes(body.importance) ? body.importance : null;
  }

  // Atualizar ato normativo
  try {
    const act = await prisma.legislativeAct.update({
      where: { id },
      data: updateData
    });

    // Invalidate caches (legislative acts + lei articles if leiArticles changed)
    await CacheInvalidation.legislativeActs();
    // Also invalidate lei articles since the linked documents may have changed
    await CacheInvalidation.leiArticles();

    return NextResponse.json({
      success: true,
      act
    });
  } catch (error: unknown) {
    // Erro de unique constraint (fullNumber duplicado)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ConflictError('Já existe outro ato normativo com este número/ano');
    }
    throw error;
  }
});

/**
 * DELETE /api/admin/legislative-acts/[id]
 * Exclui um ato normativo
 */
export const DELETE = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  // Verificar se o ato existe
  const existing = await prisma.legislativeAct.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Ato normativo');
  }

  // Excluir ato normativo
  await prisma.legislativeAct.delete({
    where: { id }
  });

  // Invalidate caches
  await CacheInvalidation.legislativeActs();
  // Also invalidate lei articles since linked documents are now gone
  await CacheInvalidation.leiArticles();

  return NextResponse.json({
    success: true,
    message: 'Ato normativo excluído com sucesso'
  });
});
