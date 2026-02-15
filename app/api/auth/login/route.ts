import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken } from '@/lib/auth';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { validateRequest } from '@/lib/validation-helper';
import { LoginSchema } from '@/lib/validation-schemas';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  AuthenticationError,
  AuthorizationError,
} from '@/lib/errors/api-error';
import { authLogger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/monitoring/events';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 tentativas de login por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:login:${ip}`, 5, 60);

    // ✅ Validação com Zod
    const validation = await validateRequest(request, LoginSchema);

    if (validation.error) {
      return validation.error;
    }

    const { email, password } = validation.data;

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        enrollments: true, // Incluir matrículas do aluno
      },
    });

    if (!user) {
      authLogger.warn({ email }, 'Login attempt: user not found');
      throw new AuthenticationError('Email ou senha incorretos');
    }

    // Verificar se é um aluno (não admin)
    if (user.role !== 'student') {
      authLogger.warn({ email, role: user.role }, 'Login attempt: wrong role');
      throw new AuthorizationError('Use o login administrativo para acessar');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      authLogger.warn({ email, userId: user.id }, 'Login attempt: invalid password');
      throw new AuthenticationError('Email ou senha incorretos');
    }

    // Verificar se o email foi verificado
    if (!user.emailVerified) {
      authLogger.warn({ email, userId: user.id }, 'Login attempt: email not verified');
      return NextResponse.json(
        {
          error: 'Email não verificado',
          message: 'Por favor, verifique seu email antes de fazer login. Verifique sua caixa de entrada.',
          needsVerification: true,
        },
        { status: 403 }
      );
    }

    // Gerar JWT token via lib/auth (unificado com jose)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'student',
      validUntil: thirtyDaysFromNow,
    });

    // Registrar log de acesso
    try {
      await prisma.accessLog.create({
        data: {
          userId: user.id,
          action: 'login',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      authLogger.error({ err: logError, userId: user.id }, 'Failed to create access log');
      // Não falhar o login se o log falhar
    }

    authLogger.info({ userId: user.id, email: user.email }, 'Login successful');
    trackServerEvent('user_login', { role: user.role });

    // Criar resposta com cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          enrollments: user.enrollments,
        },
      },
      { status: 200 }
    );

    // Definir cookie com token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: '/',
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
