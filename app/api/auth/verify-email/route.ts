import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';

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

    // Atualizar usuário para verificado
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    // Auto-login após verificação (usa módulo auth centralizado — sem segredos hardcoded)
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
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
