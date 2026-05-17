import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { CreateLessonSchema } from '@/lib/validation-schemas';
import { setLeiArticles } from '@/lib/lei-articles';

/**
 * POST: Cria uma nova lição
 */
export const POST = withAdminApi(async (request: NextRequest) => {
  const body = await request.json();
    const data = CreateLessonSchema.parse(body);

    // Verificar se o módulo existe
    const parentModule = await prisma.module.findUnique({
      where: { id: data.moduleId },
    });
    if (!parentModule) {
      throw new NotFoundError('Módulo');
    }

    // Auto-set displayOrder se não fornecido
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await prisma.lesson.aggregate({
        where: { moduleId: data.moduleId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    const lesson = await prisma.lesson.create({
      data: {
        moduleId: data.moduleId,
        title: data.title,
        slug: data.slug,
        description: data.description,
        content: data.content,
        displayOrder,
        isPublished: data.isPublished ?? false,
        estimatedMinutes: data.estimatedMinutes,
        ...setLeiArticles(data.leiArticles ?? null),
        prerequisiteId: data.prerequisiteId || null,
      },
    });

    apiLogger.info({ lessonId: lesson.id, moduleId: data.moduleId }, 'Lesson created');
    return NextResponse.json({ lesson }, { status: 201 });
});
