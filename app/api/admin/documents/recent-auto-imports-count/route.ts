import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET: Conta documentos auto-importados nos últimos 7 dias
 */
export const GET = withAdminAuth(async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const count = await prisma.document.count({
      where: {
        reviewedBy: { in: ['auto-sync-tcu', 'auto-migration'] },
        reviewedAt: { gte: sevenDaysAgo },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('[Recent Auto Imports Count] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao contar importações automáticas' },
      { status: 500 }
    );
  }
});
