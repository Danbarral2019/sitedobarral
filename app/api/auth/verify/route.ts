import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkAccessStatus } from '@/lib/enrollment-utils';
import { prisma } from '@/lib/prisma';
import { reportError } from '@/lib/monitoring/report-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { ApiError, AuthenticationError, AuthorizationError } from '@/lib/errors/api-error';



export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AuthenticationError('Não autenticado');
    }

    // Para estudantes via QR Code, verifica acesso pelo enrollment
    if (user.role === 'student' && user.courseId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          enrollments: {
            where: { courseId: user.courseId }
          }
        }
      });

      if (!dbUser) {
        throw new AuthenticationError('Usuário não encontrado');
      }

      // Verifica se tem matrícula no curso
      const enrollment = dbUser.enrollments[0];
      if (!enrollment) {
        throw new AuthorizationError('Você não está matriculado neste curso');
      }

      // Verifica status do acesso
      const accessStatus = checkAccessStatus(enrollment);

      if (accessStatus.isExpired) {
        throw new ApiError(403, 'Acesso expirado', 'ACCESS_EXPIRED', { expired: true });
      }

      if (!accessStatus.hasAccess) {
        throw new AuthorizationError('Sem acesso ao curso');
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: user.userId,
        role: user.role,
        courseId: user.courseId,
        turma: user.turma,
      },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      reportError(error, 'auth', { rota: 'verify' });
    }
    return handleApiError(error);
  }
}
