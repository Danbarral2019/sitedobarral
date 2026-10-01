import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { reportError } from '@/lib/monitoring/report-error';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  ApiError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/api-error';


export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 tentativas de login admin por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:admin:${ip}`, 5, 60, { failureMode: 'closed' });

    const { email, password } = await request.json();

    if (!email || !password) {
      throw new ValidationError('E-mail e senha são obrigatórios');
    }

    // Busca usuário admin no banco de dados
    const admin = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      },
    });

    if (!admin || admin.role !== 'admin') {
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

    if (!isValidPassword) {
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Gera token JWT para admin
    const token = await generateToken({
      userId: admin.id,
      role: 'admin',
      tv: admin.tokenVersion,
    });

    // Define cookie
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'admin',
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return handleApiError(
        new RateLimitError('Muitas tentativas de login. Tente novamente em alguns instantes.')
      );
    }
    if (!(error instanceof ApiError)) {
      reportError(error, 'auth', { rota: 'admin-login' });
    }
    return handleApiError(error);
  }
}
