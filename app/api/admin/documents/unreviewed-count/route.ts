import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET: Conta documentos não revisados
 */
export const GET = withAdminAuth(async () => {
  try {
    const count = await prisma.document.count({
      where: {
        reviewed: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('[Unreviewed Count] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao contar documentos não revisados' },
      { status: 500 }
    );
  }
});
