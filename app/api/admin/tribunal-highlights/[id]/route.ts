import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';

/**
 * GET /api/admin/tribunal-highlights/[id]
 * Busca highlight individual com dados da decisão
 */
export const GET = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const highlight = await prisma.tribunalHighlight.findUnique({
    where: { id },
    include: {
      tribunalDecision: {
        select: {
          id: true,
          title: true,
          ementa: true,
          url: true,
          tribunalCode: true,
          tribunalName: true,
          decisionNumber: true,
          year: true,
          relator: true,
          orgaoJulgador: true,
          dataJulgamento: true,
          leiArticlesArr: true,
          themes: true,
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
 * PATCH /api/admin/tribunal-highlights/[id]
 * Atualiza status e notas de um destaque TCE
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
  const existing = await prisma.tribunalHighlight.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Destaque');
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  if (blogPostId !== undefined) updateData.blogPostId = blogPostId;

  const updated = await prisma.tribunalHighlight.update({
    where: { id },
    data: updateData,
    include: {
      tribunalDecision: {
        select: {
          id: true,
          title: true,
          url: true,
          tribunalCode: true,
        },
      },
    },
  });

  return NextResponse.json({ highlight: updated });
});
