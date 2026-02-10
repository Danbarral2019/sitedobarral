import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { ReorderSchema } from '@/lib/validation-schemas';

/**
 * PUT: Reordena lições
 */
export const PUT = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { items } = ReorderSchema.parse(body);

    await prisma.$transaction(
      items.map((item) =>
        prisma.lesson.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    apiLogger.info({ count: items.length }, 'Lessons reordered');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
});
