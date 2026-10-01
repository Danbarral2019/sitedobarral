import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { reportError } from '@/lib/monitoring/report-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { ApiError, AuthenticationError, NotFoundError } from '@/lib/errors/api-error';

export async function GET(request: NextRequest) {
  try {
    // ✅ Obter token do cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autenticado');
    }

    // ✅ Verificar token usando função centralizada (com validação Zod)
    const authPayload = await verifyToken(token);

    if (!authPayload) {
      throw new AuthenticationError('Token inválido ou expirado');
    }

    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      include: {
        enrollments: true,
        subscriptions: {
          where: { status: { in: ['active', 'past_due'] } },
          select: {
            id: true,
            plan: true,
            courseId: true,
            billingCycle: true,
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        enrollments: user.enrollments,
        subscriptions: user.subscriptions,
      },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      reportError(error, 'auth', { rota: 'me' });
    }
    return handleApiError(error);
  }
}
