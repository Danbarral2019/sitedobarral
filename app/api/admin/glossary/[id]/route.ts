import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

// Função helper para gerar slug
function generateSlug(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// PUT /api/admin/glossary/[id] - Atualizar termo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      term,
      definition,
      shortDef,
      category,
      relatedTerms,
      leiArticles,
      relatedDocs,
      externalUrl,
      isPublic,
    } = body;

    // Verificar se termo existe
    const existing = await prisma.glossaryTerm.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Termo não encontrado' },
        { status: 404 }
      );
    }

    // Preparar dados para atualização
    const data: Prisma.GlossaryTermUpdateInput = {};

    if (term !== undefined) {
      data.term = term.trim();
      data.slug = generateSlug(term);

      // Verificar se novo slug já existe (em outro termo)
      const slugConflict = await prisma.glossaryTerm.findFirst({
        where: {
          slug: data.slug,
          id: { not: id },
        },
      });

      if (slugConflict) {
        return NextResponse.json(
          { error: 'Já existe um termo com este nome' },
          { status: 400 }
        );
      }
    }

    if (definition !== undefined) {
      data.definition = definition.trim();
    }

    if (shortDef !== undefined) {
      data.shortDef = shortDef?.trim() || null;
    }

    if (category !== undefined) {
      data.category = category?.trim() || null;
    }

    if (externalUrl !== undefined) {
      data.externalUrl = externalUrl?.trim() || null;
    }

    if (isPublic !== undefined) {
      data.isPublic = isPublic;
    }

    // Atualizar relacionamentos (JSON)
    if (relatedTerms !== undefined) {
      data.relatedTerms = Array.isArray(relatedTerms)
        ? JSON.stringify(relatedTerms)
        : null;
    }

    if (leiArticles !== undefined) {
      data.leiArticlesArr = Array.isArray(leiArticles) ? leiArticles.map(String) : [];
    }

    if (relatedDocs !== undefined) {
      data.relatedDocs = Array.isArray(relatedDocs)
        ? JSON.stringify(relatedDocs)
        : null;
    }

    // Atualizar termo
    const updatedTerm = await prisma.glossaryTerm.update({
      where: { id },
      data,
    });

    // Invalidate glossary cache
    await CacheInvalidation.glossary();

    return NextResponse.json({
      term: updatedTerm,
      message: 'Termo atualizado com sucesso',
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error updating glossary term:');
    return NextResponse.json(
      { error: 'Erro ao atualizar termo' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/glossary/[id] - Deletar termo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    // Verificar se termo existe
    const existing = await prisma.glossaryTerm.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Termo não encontrado' },
        { status: 404 }
      );
    }

    // Deletar termo
    await prisma.glossaryTerm.delete({
      where: { id },
    });

    // Invalidate glossary cache
    await CacheInvalidation.glossary();

    return NextResponse.json({
      message: 'Termo deletado com sucesso',
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Error deleting glossary term:');
    return NextResponse.json(
      { error: 'Erro ao deletar termo' },
      { status: 500 }
    );
  }
}
