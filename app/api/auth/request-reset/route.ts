import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/**
 * POST /api/auth/request-reset
 * Solicita reset de senha - gera token e salva no banco
 */
export async function POST(request: NextRequest) {
  try {
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

    // TODO: Aqui você pode implementar envio de email
    // Por enquanto, vamos retornar o link para fins de desenvolvimento
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/redefinir-senha?token=${resetToken}`;

    // Em produção, você enviaria o email aqui
    // await sendPasswordResetEmail(user.email, resetUrl);

    console.log('🔑 Reset de senha solicitado para:', user.email);
    console.log('🔗 Link de reset:', resetUrl);
    console.log('⏰ Token válido até:', resetTokenExpiry.toLocaleString('pt-BR'));

    return NextResponse.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.',
      // ATENÇÃO: Remover este campo em produção! Só para desenvolvimento
      devInfo: process.env.NODE_ENV === 'development' ? {
        resetUrl,
        expiresAt: resetTokenExpiry.toISOString(),
      } : undefined,
    });
  } catch (error) {
    console.error('Erro ao solicitar reset de senha:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
