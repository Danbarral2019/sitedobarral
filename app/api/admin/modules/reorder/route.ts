import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { ReorderSchema } from '@/lib/validation-schemas';

/**
 * PUT: Reordena módulos
 */
export const PUT = withAdminApi(async (request: NextRequest) => {
  const body = await request.json();
  const { items } = ReorderSchema.parse(body);

  await prisma.$transaction(
    items.map((item) =>
      prisma.module.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    )
  );

  apiLogger.info({ count: items.length }, 'Modules reordered');
  return NextResponse.json({ success: true });
});
