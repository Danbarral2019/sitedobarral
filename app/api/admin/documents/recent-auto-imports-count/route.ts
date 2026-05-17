import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET: Conta documentos auto-importados nos últimos 7 dias
 */
export const GET = withAdminApi(async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const count = await prisma.document.count({
    where: {
      reviewedBy: { in: ['auto-sync-tcu', 'auto-migration'] },
      reviewedAt: { gte: sevenDaysAgo },
    },
  });

  return NextResponse.json({ count });
});
