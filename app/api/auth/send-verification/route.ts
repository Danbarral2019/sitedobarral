import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimiters } from '@/lib/rate-limit';

/**
 * POST /api/auth/send-verification
 * Envia código de verificação de email (ou reenvia)
 */
export async function POST(request: NextRequest) {
  // Rate limiting: 5 envios de código de verificação por minuto
  try {
    await rateLimiters.auth.check(request, 5);
  } catch {
    return NextResponse.json(
      { error: 'Muitas tentativas de envio. Por favor, aguarde alguns instantes.' },
      { status: 429 }
    );
  }

  try {
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

    // Gera código de 6 dígitos
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Token válido por 30 minutos
    const emailTokenExpiry = new Date();
    emailTokenExpiry.setMinutes(emailTokenExpiry.getMinutes() + 30);

    // Salva no banco
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: verificationCode,
        verificationExpiry: emailTokenExpiry,
      },
    });

    // TODO: Aqui você implementaria o envio de email
    // Por enquanto, vamos logar no console para desenvolvimento
    console.log('📧 Código de verificação para:', user.email);
    console.log('🔑 Código:', verificationCode);
    console.log('⏰ Válido até:', emailTokenExpiry.toLocaleString('pt-BR'));

    return NextResponse.json({
      success: true,
      message: 'Código de verificação enviado para seu email.',
      // ATENÇÃO: Remover em produção! Só para desenvolvimento
      devInfo: process.env.NODE_ENV === 'development' ? {
        code: verificationCode,
        expiresAt: emailTokenExpiry.toISOString(),
      } : undefined,
    });
  } catch {
    console.error('Erro ao enviar código de verificação:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
