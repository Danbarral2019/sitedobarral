import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateModuleSchema } from '@/lib/validation-schemas';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET: Busca um módulo por ID com lições
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundError('Módulo');
    }

    apiLogger.info({ moduleId: id }, 'Module fetched');
    return NextResponse.json({ module });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT: Atualiza um módulo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const data = UpdateModuleSchema.parse(body);

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Módulo');
    }

    const module = await prisma.module.update({
      where: { id },
      data,
      include: {
        _count: { select: { lessons: true } },
      },
    });

    apiLogger.info({ moduleId: id }, 'Module updated');
    return NextResponse.json({ module });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove um módulo (cascade para lições)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const existing = await prisma.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Módulo');
    }

    await prisma.module.delete({ where: { id } });

    apiLogger.info({ moduleId: id }, 'Module deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
