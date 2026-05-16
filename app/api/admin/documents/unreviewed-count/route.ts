import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

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
    apiLogger.error({ err: error }, '[Unreviewed Count] Erro:');
    return NextResponse.json(
      { error: 'Erro ao contar documentos não revisados' },
      { status: 500 }
    );
  }
});
