import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkAccessStatus } from '@/lib/enrollment-utils';
import { prisma } from '@/lib/prisma';


export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
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
        return NextResponse.json({ authenticated: false, error: 'Usuário não encontrado' }, { status: 401 });
      }

      // Verifica se tem matrícula no curso
      const enrollment = dbUser.enrollments[0];
      if (!enrollment) {
        return NextResponse.json(
          { authenticated: false, error: 'Você não está matriculado neste curso' },
          { status: 403 }
        );
      }

      // Verifica status do acesso
      const accessStatus = checkAccessStatus(enrollment);

      if (accessStatus.isExpired) {
        return NextResponse.json(
          { authenticated: false, error: 'Acesso expirado', expired: true },
          { status: 403 }
        );
      }

      if (!accessStatus.hasAccess) {
        return NextResponse.json(
          { authenticated: false, error: 'Sem acesso ao curso' },
          { status: 403 }
        );
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
    console.error('Erro ao verificar autenticação:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Erro ao verificar acesso' },
      { status: 500 }
    );
  }
}
