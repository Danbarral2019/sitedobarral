import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

/**
 * GET: Listar todos os certificados do usuário autenticado
 */
export const GET = withUserApi(async (
  _request: NextRequest,
  ctx
) => {
  const certificates = await prisma.certificate.findMany({
    where: { userId: ctx.user.userId },
    orderBy: { issuedAt: 'desc' },
  });

  return NextResponse.json({ certificates });
});
