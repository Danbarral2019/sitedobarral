import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação usando função centralizada
    const auth = await verifyAuth(request);

    if (!auth.valid || !auth.user) {
      throw new AuthenticationError();
    }

    // Apenas admins podem conceder acesso vitalício
    if (auth.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem conceder acesso vitalício' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { courseId, price } = body;

    if (!courseId) {
      throw new ValidationError('ID do curso é obrigatório');
    }

    // Buscar enrollment existente
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: auth.user.userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundError('Matrícula');
    }

    // Verificar se já é vitalício
    if (enrollment.isLifetime) {
      throw new ValidationError('Você já tem acesso vitalício a este curso');
    }

    // Atualizar enrollment para vitalício
    const updatedEnrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        isLifetime: true,
        lifetimeUpgradedAt: new Date(),
        lifetimePrice: price || null,
        expiresAt: null, // Remove expiração
      },
    });

    // Registrar log de acesso
    try {
      await prisma.accessLog.create({
        data: {
          userId: auth.user.userId,
          courseId,
          action: 'upgrade_lifetime',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      apiLogger.error({ err: logError, userId: auth.user.userId }, 'Erro ao registrar log de upgrade');
    }

    apiLogger.info({ userId: auth.user.userId, courseId }, 'Lifetime upgrade successful');
    trackServerEvent('enrollment_upgrade', { courseId });

    return NextResponse.json(
      {
        success: true,
        message: 'Upgrade realizado com sucesso!',
        enrollment: {
          id: updatedEnrollment.id,
          courseId: updatedEnrollment.courseId,
          isLifetime: updatedEnrollment.isLifetime,
          lifetimeUpgradedAt: updatedEnrollment.lifetimeUpgradedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
