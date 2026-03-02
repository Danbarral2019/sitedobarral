import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import bcrypt from 'bcryptjs';


export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação — apenas admins logados podem alterar senha
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Rate limiting: 5 tentativas por minuto por IP
    const ip = getClientIp(request);
    await enforceRateLimit(`auth:change-password:${ip}`, 5, 60);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validações básicas
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário admin pelo userId da sessão (não do body)
    const user = await prisma.user.findUnique({
      where: { id: authResult.user.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 401 }
      );
    }

    // Gerar hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha no banco
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Senha alterada com sucesso',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
        { status: 429 }
      );
    }
    console.error('Erro ao alterar senha:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
