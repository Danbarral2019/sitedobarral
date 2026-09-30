import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';
import { reportError } from '@/lib/monitoring/report-error';
import { activatePendingQrEnrollment } from '@/lib/qr-enrollment';
import { sendCourseWelcomeEmail } from '@/lib/email';
import { courses } from '@/data/courses';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      throw new ValidationError('Token de verificação é obrigatório');
    }

    // Buscar usuário pelo token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new ValidationError('Token inválido ou expirado');
    }

    // Verificar se o token expirou
    if (user.verificationExpiry && new Date() > user.verificationExpiry) {
      throw new ValidationError('Token expirado. Solicite um novo email de verificação.');
    }

    // Atualizar usuário para verificado. A condição sobre o token torna o
    // consumo atômico: numa chamada duplicada (StrictMode, duplo clique) só
    // uma passa daqui, e a matrícula por QR não é tentada duas vezes.
    const claimed = await prisma.user.updateMany({
      where: { id: user.id, verificationToken: token },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
        pendingQrCodeId: null,
      },
    });

    if (claimed.count === 0) {
      throw new ValidationError('Token inválido ou expirado');
    }

    // QR code guardado no cadastro: só agora a matrícula é criada e a vaga,
    // consumida. Sem vaga (ou QR vencido), o email fica verificado mesmo assim.
    if (user.pendingQrCodeId) {
      try {
        const result = await activatePendingQrEnrollment(user.id, user.pendingQrCodeId);
        if (result.status === 'enrolled') {
          const courseData = courses.find(c => c.id === result.courseId);
          if (courseData) {
            sendCourseWelcomeEmail(user.email, user.name, courseData.title, courseData.slug).catch((err) => {
              authLogger.error({ err, userId: user.id }, 'Failed to send course welcome email');
            });
          }
        }
      } catch (enrollmentError) {
        authLogger.error(
          { err: enrollmentError, userId: user.id, qrCodeId: user.pendingQrCodeId },
          'Failed to create QR enrollment at email verification'
        );
        reportError(enrollmentError, 'auth', { etapa: 'matricula-qr', userId: user.id });
      }
    }

    // Auto-login após verificação (usa módulo auth centralizado — sem segredos hardcoded)
    const jwtToken = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'student',
      tv: user.tokenVersion,
    });

    // Buscar usuário atualizado com enrollments
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { enrollments: true },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Email verificado com sucesso!',
        user: {
          id: updatedUser!.id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role,
          enrollments: updatedUser!.enrollments,
        },
      },
      { status: 200 }
    );

    // Definir cookie de autenticação
    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 dias (alinhado com JWT)
      path: '/',
    });

    authLogger.info({ userId: user.id }, 'Email verificado com sucesso');
    trackServerEvent('email_verified');
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
