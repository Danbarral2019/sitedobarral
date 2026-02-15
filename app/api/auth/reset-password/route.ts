import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      throw new ValidationError('Token e nova senha são obrigatórios');
    }

    if (newPassword.length < 6) {
      throw new ValidationError('A senha deve ter no mínimo 6 caracteres');
    }

    // Buscar usuário pelo token
    const user = await prisma.user.findUnique({
      where: { resetPasswordToken: token },
    });

    if (!user) {
      throw new ValidationError('Token inválido ou expirado');
    }

    // Verificar se o token expirou
    if (user.resetPasswordExpiry && new Date() > user.resetPasswordExpiry) {
      throw new ValidationError('Token expirado. Solicite um novo link de redefinição.');
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha e limpar token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    // Auto-login após redefinição (usa módulo auth centralizado — sem segredos hardcoded)
    const jwtToken = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'student',
    });

    // Buscar usuário atualizado com enrollments
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { enrollments: true },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Senha redefinida com sucesso!',
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

    // Registrar log
    try {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          action: 'password_reset',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      authLogger.error({ err: logError }, 'Erro ao registrar log de reset de senha');
    }

    authLogger.info({ userId: user.id }, 'Senha redefinida com sucesso');
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
