import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

// GET - Busca uma publicação específica
export const GET = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;

    const publication = await prisma.publication.findUnique({
      where: { id }
    });

    if (!publication) {
      return NextResponse.json(
        { error: 'Publicação não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ publication });
  } catch (error) {
    console.error('Erro ao buscar publicação:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar publicação' },
      { status: 500 }
    );
  }
});

// PUT - Atualiza uma publicação
export const PUT = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;
    const data = await request.json();

    // Verificar se a publicação existe
    const existing = await prisma.publication.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Publicação não encontrada' },
        { status: 404 }
      );
    }

    // Validar tipo se fornecido
    if (data.type && !['livro', 'artigo', 'noticia'].includes(data.type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use: livro, artigo ou noticia' },
        { status: 400 }
      );
    }

    const publication = await prisma.publication.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.content !== undefined && { content: data.content || null }),
        ...(data.author && { author: data.author }),
        ...(data.publishedAt && { publishedAt: new Date(data.publishedAt) }),
        ...(typeof data.isPublished === 'boolean' && { isPublished: data.isPublished }),
        ...(data.publisher !== undefined && { publisher: data.publisher || null }),
        ...(data.isbn !== undefined && { isbn: data.isbn || null }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage || null }),
        ...(data.externalUrl !== undefined && { externalUrl: data.externalUrl || null }),
        ...(data.journal !== undefined && { journal: data.journal || null }),
        ...(data.eventDate !== undefined && { eventDate: data.eventDate ? new Date(data.eventDate) : null }),
        ...(data.location !== undefined && { location: data.location || null }),
      },
    });

    // Invalidate cache
    CacheInvalidation.publications().catch(console.error);

    return NextResponse.json({ publication });
  } catch (error) {
    console.error('Erro ao atualizar publicação:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar publicação' },
      { status: 500 }
    );
  }
});

// DELETE - Remove uma publicação
export const DELETE = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await context.params;

    const publication = await prisma.publication.findUnique({
      where: { id }
    });

    if (!publication) {
      return NextResponse.json(
        { error: 'Publicação não encontrada' },
        { status: 404 }
      );
    }

    await prisma.publication.delete({
      where: { id }
    });

    // Invalidate cache
    CacheInvalidation.publications().catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar publicação:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar publicação' },
      { status: 500 }
    );
  }
});
