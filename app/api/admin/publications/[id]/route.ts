import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

// GET - Busca uma publicação específica
export const GET = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  const publication = await prisma.publication.findUnique({
    where: { id }
  });

  if (!publication) {
    throw new NotFoundError('Publicação');
  }

  return NextResponse.json({ publication });
});

// PUT - Atualiza uma publicação
export const PUT = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;
  const data = await request.json();

  // Verificar se a publicação existe
  const existing = await prisma.publication.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new NotFoundError('Publicação');
  }

  // Validar tipo se fornecido
  if (data.type && !['livro', 'artigo', 'noticia'].includes(data.type)) {
    throw new ValidationError('Tipo inválido. Use: livro, artigo ou noticia');
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
});

// DELETE - Remove uma publicação
export const DELETE = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  const publication = await prisma.publication.findUnique({
    where: { id }
  });

  if (!publication) {
    throw new NotFoundError('Publicação');
  }

  await prisma.publication.delete({
    where: { id }
  });

  // Invalidate cache
  CacheInvalidation.publications().catch(console.error);

  return NextResponse.json({ success: true });
});
