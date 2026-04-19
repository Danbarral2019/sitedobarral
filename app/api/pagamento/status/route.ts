import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { withAuth } from '@/lib/api-middleware';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { apiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors/api-error';

export const runtime = 'nodejs';

/**
 * GET /api/pagamento/status?session_id=cs_test_...
 *
 * Used by the `/assinatura/sucesso` page to poll the subscription status
 * for a given checkout session. Returns `{ subscription }` where
 * `subscription` is `null` while the webhook hasn't yet persisted the row.
 *
 * The session is retrieved from Stripe to:
 *  - confirm the session belongs to the authenticated user
 *    (prevents enumerating other users' sessions)
 *  - resolve the `stripeSubscriptionId` to look up in our DB
 */
export const GET = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string };
    const sessionId = new URL(request.url).searchParams.get('session_id');

    if (!sessionId) {
      throw new ValidationError('session_id é obrigatório');
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await getStripe().checkout.sessions.retrieve(sessionId);
    } catch (err) {
      apiLogger.warn({ err, sessionId }, 'Checkout session not found');
      throw new NotFoundError('Sessão de checkout não encontrada');
    }

    if (session.metadata?.userId && session.metadata.userId !== user.userId) {
      apiLogger.warn(
        { sessionId, sessionUser: session.metadata.userId, requester: user.userId },
        'User tried to poll status of another user session',
      );
      throw new AuthorizationError('Sessão não pertence ao usuário autenticado');
    }

    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

    if (!stripeSubscriptionId) {
      return NextResponse.json({ subscription: null });
    }

    const sub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: {
        status: true,
        plan: true,
        billingCycle: true,
        currentPeriodEnd: true,
        paymentMethod: true,
      },
    });

    return NextResponse.json({ subscription: sub });
  } catch (error) {
    return handleApiError(error);
  }
});
