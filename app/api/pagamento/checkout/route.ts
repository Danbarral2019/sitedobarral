import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api-middleware';
import { createCheckoutPreference, getPlanConfig, type PlanType, type BillingCycle } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

const CheckoutSchema = z.object({
  plan: z.enum(['basico', 'premium']),
  courseId: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export const POST = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string; email?: string; name?: string };
    const body = await request.json();
    const result = CheckoutSchema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message || 'Dados inválidos');
    }

    const { plan, courseId, billingCycle } = result.data;

    if (plan === 'basico' && !courseId) {
      throw new ValidationError('courseId é obrigatório para o plano Básico');
    }

    // Verificar config do plano
    getPlanConfig(plan as PlanType, billingCycle as BillingCycle);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, name: true },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const url = await createCheckoutPreference({
      userId: user.userId,
      email: dbUser?.email || user.email || '',
      name: dbUser?.name || user.name || '',
      plan: plan as PlanType,
      courseId,
      returnUrl: baseUrl,
      billingCycle: billingCycle as BillingCycle,
    });

    apiLogger.info({ userId: user.userId, plan, courseId, billingCycle }, 'MP checkout initiated');
    trackServerEvent('payment_checkout', { plan });

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
});
