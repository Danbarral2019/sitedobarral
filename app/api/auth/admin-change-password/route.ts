import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, verifyAuth } from '@/lib/auth';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import bcrypt from 'bcryptjs';
import { reportError } from '@/lib/monitoring/report-error';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  ApiError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/api-error';


export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação — apenas admins logados podem alterar senha
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
    }

    // Rate limiting: 5 tentativas por minuto por IP
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:change-password:${ip}`, 5, 60, { failureMode: 'closed' });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validações básicas
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Senha atual e nova senha são obrigatórios');
    }

    if (newPassword.length < 8) {
      throw new ValidationError('A nova senha deve ter no mínimo 8 caracteres');
    }

    // Buscar usuário admin pelo userId da sessão (não do body)
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.userId },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new AuthenticationError('Senha atual incorreta');
    }

    // Gerar hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha no banco e revogar todas as sessões abertas
    // (incremento de tokenVersion).
    const { tokenVersion } = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Senha alterada com sucesso',
      },
      { status: 200 }
    );

    // A sessão de quem trocou a senha continua: recebe um token na versão nova.
    // As demais (outros navegadores, token vazado) deixam de valer.
    const token = await generateToken({ userId: user.id, role: 'admin', tv: tokenVersion });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 dias (igual ao admin-login)
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return handleApiError(
        new RateLimitError('Muitas tentativas. Aguarde antes de tentar novamente.')
      );
    }
    if (!(error instanceof ApiError)) {
      reportError(error, 'auth', { rota: 'admin-change-password' });
    }
    return handleApiError(error);
  }
}
