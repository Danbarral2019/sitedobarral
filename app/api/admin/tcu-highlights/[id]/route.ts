import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';

/**
 * GET /api/admin/tcu-highlights/[id]
 * Busca highlight individual com dados do documento/acordao
 */
export const GET = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const highlight = await prisma.tcuHighlight.findUnique({
    where: { id },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          url: true,
          description: true,
          acordaoNumero: true,
          acordaoAno: true,
          leiArticles: true, leiArticlesArr: true,
          metaTcu: {
            select: {
              relator: true,
              orgaoJulgador: true,
              dataJulgamento: true,
              area: true,
              tema: true,
              subtema: true,
            },
          },
        },
      },
    },
  });

  if (!highlight) {
    throw new NotFoundError('Destaque');
  }

  return NextResponse.json({ highlight });
});

/**
 * PATCH /api/admin/tcu-highlights/[id]
 * Atualiza status e notas de um destaque TCU
 */
export const PATCH = withAdminApi<{ id: string }>(async (request, { params }) => {
  const { id } = params;

  const body = await request.json();
  const { status, adminNotes, blogPostId } = body;

  // Validar status
  const validStatuses = ['pending', 'dismissed', 'will_write', 'written'];
  if (status && !validStatuses.includes(status)) {
    throw new ValidationError(`Status inválido. Valores aceitos: ${validStatuses.join(', ')}`);
  }

  // Verificar se existe
  const existing = await prisma.tcuHighlight.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Destaque');
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  if (blogPostId !== undefined) updateData.blogPostId = blogPostId;

  const updated = await prisma.tcuHighlight.update({
    where: { id },
    data: updateData,
    include: {
      document: {
        select: {
          id: true,
          title: true,
          url: true,
        },
      },
    },
  });

  return NextResponse.json({ highlight: updated });
});
