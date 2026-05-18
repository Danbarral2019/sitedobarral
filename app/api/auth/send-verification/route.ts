import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { sendVerificationEmail } from '@/lib/email';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/auth/send-verification
 * Envia código de verificação de email (ou reenvia)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 envios de código de verificação por minuto (Redis)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:verify:${ip}`, 5, 60);

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Busca usuário
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Por segurança, retorna sucesso mesmo se não encontrar
      return NextResponse.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
      });
    }

    // Se já verificado, retorna sucesso
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email já verificado!',
        alreadyVerified: true,
      });
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
    const emailSent = await sendVerificationEmail(user.email, user.name, verificationToken);

    if (!emailSent) {
      console.warn('⚠️ Não foi possível enviar o email de verificação, mas o código foi salvo.');
    }

    return NextResponse.json({
      success: true,
      message: 'Link de verificação enviado para seu email.',
      // ATENÇÃO: Remover em produção! Só para desenvolvimento
      devInfo: process.env.NODE_ENV === 'development' ? {
        token: verificationToken,
        expiresAt: emailTokenExpiry.toISOString(),
      } : undefined,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Muitas tentativas de envio. Por favor, aguarde alguns instantes.' },
        { status: 429 }
      );
    }
    apiLogger.error({ err: error }, 'Erro ao enviar código de verificação:');
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
