import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';

/**
 * GET: Listar todos os certificados do usuário autenticado
 */
export const GET = withAuth(async (
  _request: NextRequest,
  context?: Record<string, unknown>
) => {
  try {
    const user = context?.user as { userId: string };

    const certificates = await prisma.certificate.findMany({
      where: { userId: user.userId },
      orderBy: { issuedAt: 'desc' },
    });

    return NextResponse.json({ certificates });
  } catch (error) {
    return handleApiError(error);
  }
});
