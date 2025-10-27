import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    // Validações básicas
    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    // Buscar usuário admin
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem usar esta funcionalidade.' },
        { status: 403 }
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
    console.error('Erro ao alterar senha:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
}
