import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 tentativas por minuto por IP (previne spam de emails de reset)
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:forgot-password:${ip}`, 3, 60);

    const body = await request.json();
    const { email } = body;

    if (!email) {
      throw new ValidationError('Email é obrigatório');
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Por segurança, sempre retorna sucesso mesmo se email não existir
    // Isso evita que atacantes descubram quais emails estão cadastrados
    if (!user) {
      return NextResponse.json(
        {
          success: true,
          message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.',
        },
        { status: 200 }
      );
    }

    // Gerar token de redefinição de senha
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date();
    resetExpiry.setHours(resetExpiry.getHours() + 1); // Token válido por 1 hora

    // Atualizar usuário com token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetExpiry,
      },
    });

    // Enviar email com link de redefinição
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailError) {
      apiLogger.error({ err: emailError }, 'Erro ao enviar email de redefinição:');
      // Continua mesmo se email falhar - usuário pode tentar novamente
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.',
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
