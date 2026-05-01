import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';

/**
 * GET /api/admin/legislative-acts/[id]
 * Busca um ato normativo específico por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const { id } = await params;

    const act = await prisma.legislativeAct.findUnique({
      where: { id }
    });

    if (!act) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ act });

  } catch (error) {
    console.error('Erro ao buscar ato normativo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar ato normativo' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/legislative-acts/[id]
 * Atualiza um ato normativo existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const { id } = await params;
    const body = await request.json();

    // Verificar se o ato existe
    const existing = await prisma.legislativeAct.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
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
        return NextResponse.json(
          { error: 'Validação de formatação falhou', details: validation.errors, warnings: validation.warnings },
          { status: 422 },
        );
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
      updateData.leiArticles = body.leiArticles ? JSON.stringify(body.leiArticles) : null;
    }
    if (body.officialUrl !== undefined) updateData.officialUrl = body.officialUrl || null;
    if (body.pdfUrl !== undefined) updateData.pdfUrl = body.pdfUrl || null;
    if (normalizedContent !== undefined) updateData.content = normalizedContent;

    // Atualizar ato normativo
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
    console.error('Erro ao atualizar ato normativo:', error);

    // Erro de unique constraint (fullNumber duplicado)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe outro ato normativo com este número/ano' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar ato normativo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/legislative-acts/[id]
 * Exclui um ato normativo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar se é admin
    const adminCheck = await verifyAdmin(request);
    if (adminCheck.error) {
      return adminCheck.response;
    }

    const { id } = await params;

    // Verificar se o ato existe
    const existing = await prisma.legislativeAct.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Ato normativo não encontrado' },
        { status: 404 }
      );
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

  } catch (error) {
    console.error('Erro ao excluir ato normativo:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir ato normativo' },
      { status: 500 }
    );
  }
}
