import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateModuleSchema } from '@/lib/validation-schemas';
import { withAdminApi } from '@/lib/api/handler';

/**
 * GET: Busca um módulo por ID com lições
 */
export const GET = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  const foundModule = await prisma.module.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!foundModule) {
    throw new NotFoundError('Módulo');
  }

  apiLogger.info({ moduleId: id }, 'Module fetched');
  return NextResponse.json({ module: foundModule });
});

/**
 * PUT: Atualiza um módulo
 */
export const PUT = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;
  const body = await request.json();
  const data = UpdateModuleSchema.parse(body);

  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Módulo');
  }

  const updatedModule = await prisma.module.update({
    where: { id },
    data,
    include: {
      _count: { select: { lessons: true } },
    },
  });

  apiLogger.info({ moduleId: id }, 'Module updated');
  return NextResponse.json({ module: updatedModule });
});

/**
 * DELETE: Remove um módulo (cascade para lições)
 */
export const DELETE = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;

  const existing = await prisma.module.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Módulo');
  }

  await prisma.module.delete({ where: { id } });

  apiLogger.info({ moduleId: id }, 'Module deleted');
  return NextResponse.json({ success: true });
});
