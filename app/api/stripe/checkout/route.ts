import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api-middleware';
import { createCheckoutSession, getPlanConfig, type PlanType } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

const CheckoutSchema = z.object({
  plan: z.enum(['basico', 'premium']),
  courseId: z.string().optional(),
});

export const POST = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string; email?: string; name?: string };
    const body = await request.json();
    const result = CheckoutSchema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message || 'Dados inválidos');
    }

    const { plan, courseId } = result.data;

    // Plano básico exige courseId
    if (plan === 'basico' && !courseId) {
      throw new ValidationError('courseId é obrigatório para o plano Básico');
    }

    // Verificar se o priceId está configurado
    if (!getPlanConfig(plan as PlanType).priceId) {
      throw new ValidationError(`Plano "${plan}" não está configurado no Stripe`);
    }

    // Buscar dados do user no banco
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, name: true },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const url = await createCheckoutSession({
      userId: user.userId,
      email: dbUser?.email || user.email || '',
      name: dbUser?.name || user.name || '',
      plan: plan as PlanType,
      courseId,
      returnUrl: baseUrl,
    });

    apiLogger.info({ userId: user.userId, plan, courseId }, 'Checkout initiated');

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
});
