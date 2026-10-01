import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { sendVerificationEmail } from '@/lib/email';
import { reportError } from '@/lib/monitoring/report-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { ApiError, RateLimitError, ValidationError } from '@/lib/errors/api-error';

// Resposta única para e-mail inexistente, já verificado ou pendente: o
// endpoint não pode servir para descobrir se uma conta existe ou em que
// estado está.
const GENERIC_MESSAGE = 'Se o email estiver cadastrado e ainda não verificado, você receberá um link de verificação.';

/**
 * POST /api/auth/send-verification
 * Envia código de verificação de email (ou reenvia)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 envios de código de verificação por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:verify:${ip}`, 5, 60, { failureMode: 'closed' });

    const { email } = await request.json();

    if (!email) {
      throw new ValidationError('Email é obrigatório');
    }

    // Busca usuário
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Gera token hex seguro (mesmo formato do registro)
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Token válido por 30 minutos
    const emailTokenExpiry = new Date();
    emailTokenExpiry.setMinutes(emailTokenExpiry.getMinutes() + 30);

    // Salva no banco
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiry: emailTokenExpiry,
      },
    });

    // Envia email de verificação (gera link clicável)
    const emailSent = await sendVerificationEmail(user.email, user.name, verificationToken, '30 minutos');

    if (!emailSent) {
      console.warn('⚠️ Não foi possível enviar o email de verificação, mas o código foi salvo.');
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
      // ATENÇÃO: Remover em produção! Só para desenvolvimento
      devInfo: process.env.NODE_ENV === 'development' ? {
        token: verificationToken,
        expiresAt: emailTokenExpiry.toISOString(),
      } : undefined,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return handleApiError(
        new RateLimitError('Muitas tentativas de envio. Por favor, aguarde alguns instantes.')
      );
    }
    if (!(error instanceof ApiError)) {
      reportError(error, 'auth', { rota: 'send-verification' });
    }
    return handleApiError(error);
  }
}
