import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api-middleware';
import { createPixPayment, type PlanType } from '@/lib/mercadopago';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

const PixSchema = z.object({
  plan: z.enum(['basico', 'premium']),
  courseId: z.string().optional(),
});

export const POST = withAuth(async (request: NextRequest, context?: Record<string, unknown>) => {
  try {
    const user = context?.user as { userId: string; email?: string; name?: string };
    const body = await request.json();
    const result = PixSchema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message || 'Dados inválidos');
    }

    const { plan, courseId } = result.data;

    if (plan === 'basico' && !courseId) {
      throw new ValidationError('courseId é obrigatório para o plano Básico');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, name: true },
    });

    const pixData = await createPixPayment({
      userId: user.userId,
      email: dbUser?.email || user.email || '',
      name: dbUser?.name || user.name || '',
      plan: plan as PlanType,
      courseId,
    });

    apiLogger.info({ userId: user.userId, plan, paymentId: pixData.paymentId }, 'PIX payment initiated');
    trackServerEvent('payment_pix', { plan });

    return NextResponse.json(pixData);
  } catch (error) {
    return handleApiError(error);
  }
});
