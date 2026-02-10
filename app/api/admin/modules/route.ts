import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { CreateModuleSchema } from '@/lib/validation-schemas';

/**
 * GET: Lista modules de um curso
 * Query param: courseId (obrigatório)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId é obrigatório' },
        { status: 400 }
      );
    }

    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    apiLogger.info({ courseId, count: modules.length }, 'Modules listed');
    return NextResponse.json({ modules });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * POST: Cria um novo módulo
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const data = CreateModuleSchema.parse(body);

    // Auto-set displayOrder se não fornecido
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await prisma.module.aggregate({
        where: { courseId: data.courseId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    const module = await prisma.module.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        displayOrder,
        isPublished: data.isPublished ?? false,
      },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    apiLogger.info({ moduleId: module.id, courseId: data.courseId }, 'Module created');
    return NextResponse.json({ module }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
