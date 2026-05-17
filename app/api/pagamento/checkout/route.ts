import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserApi } from '@/lib/api/handler';
import { createCheckoutSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { ValidationError, ConflictError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

const CheckoutSchema = z.object({
  plan: z.enum(['basico', 'premium']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  method: z.enum(['card', 'pix']),
  courseId: z.string().optional(),
}).refine(
  (d) => d.plan !== 'basico' || !!d.courseId,
  { message: 'courseId obrigatório para plano Básico', path: ['courseId'] }
);

export const POST = withUserApi(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Dados inválidos');
  }

  const { plan, billingCycle, method, courseId } = parsed.data;

  const existing = await prisma.subscription.findFirst({
    where: {
      userId: ctx.user.userId,
      status: { in: ['active', 'processing', 'past_due'] },
      currentPeriodEnd: { gt: new Date() },
    },
  });
  if (existing) {
    throw new ConflictError('Você já tem uma assinatura ativa. Gerencie pelo portal.');
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const { url } = await createCheckoutSession({ userId: ctx.user.userId, plan, billingCycle, method, courseId, baseUrl });

  apiLogger.info({ userId: ctx.user.userId, plan, billingCycle, method }, 'Stripe checkout session created');
  trackServerEvent('payment_checkout', { plan });
  return NextResponse.json({ url });
});
