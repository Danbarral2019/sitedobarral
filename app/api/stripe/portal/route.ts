import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

export const POST = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string };

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { stripeCustomerId: true },
    });

    if (!dbUser?.stripeCustomerId) {
      throw new NotFoundError('Nenhuma assinatura encontrada');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = await createPortalSession(dbUser.stripeCustomerId, `${baseUrl}/area-restrita`);

    apiLogger.info({ userId: user.userId }, 'Portal session created');

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
});
