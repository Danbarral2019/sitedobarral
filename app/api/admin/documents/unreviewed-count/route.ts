import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET: Conta documentos não revisados
 */
export const GET = withAdminApi(async () => {
  const count = await prisma.document.count({
    where: {
      reviewed: false,
    },
  });

  return NextResponse.json({ count });
});
