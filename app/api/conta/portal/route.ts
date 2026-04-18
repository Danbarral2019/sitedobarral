import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createBillingPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors/error-handler';

export const runtime = 'nodejs';

/**
 * GET /api/conta/portal
 *
 * Cria uma Stripe Billing Portal session e redireciona o usuário para lá.
 * A autogestão (cartão, cancelamento, recibos) é toda feita no portal hospedado
 * pelo Stripe — o site não duplica essa UI.
 *
 * Fluxo:
 *  - Usuário sem subscription → redirect para /planos
 *  - Usuário com subscription → redirect 303 para o portal do Stripe
 */
export const GET = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string };

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.userId },
      select: { id: true },
    });

    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;

    if (!subscription) {
      apiLogger.info({ userId: user.userId }, 'Portal requested without subscription — redirecting to /planos');
      return NextResponse.redirect(`${siteUrl}/planos`, 303);
    }

    const returnUrl = `${siteUrl}/area-restrita`;
    const { url } = await createBillingPortalSession(user.userId, returnUrl);

    apiLogger.info({ userId: user.userId }, 'Billing portal session created — redirecting');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return handleApiError(error);
  }
});
