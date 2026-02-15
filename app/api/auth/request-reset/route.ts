import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { sendPasswordResetEmail } from '@/lib/email';

/**
 * POST /api/auth/request-reset
 * Solicita reset de senha - gera token e salva no banco
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 solicitações de reset por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:reset:${ip}`, 5, 60);
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Busca o usuário pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Por segurança, sempre retorna sucesso mesmo se o email não existir
    // Isso evita que atacantes descubram quais emails estão cadastrados
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.',
      });
    }

    // Gera token único e seguro
    const resetToken = randomBytes(32).toString('hex');

    // Token válido por 1 hora
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    // Salva o token no banco
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetTokenExpiry,
      },
    });

    // Envia email de recuperação de senha
    const emailSent = await sendPasswordResetEmail(user.email, user.name, resetToken);

    if (!emailSent) {
      console.warn('⚠️ Não foi possível enviar o email de reset, mas o token foi salvo.');
    }

    return NextResponse.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.',
      // ATENÇÃO: Remover este campo em produção! Só para desenvolvimento
      devInfo: process.env.NODE_ENV === 'development' ? {
        resetUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/redefinir-senha?token=${resetToken}`,
        expiresAt: resetTokenExpiry.toISOString(),
      } : undefined,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Muitas tentativas de reset de senha. Por favor, aguarde alguns instantes.' },
        { status: 429 }
      );
    }
    console.error('Erro ao solicitar reset de senha:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
