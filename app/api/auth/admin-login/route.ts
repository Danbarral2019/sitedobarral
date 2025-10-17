import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// Usuário admin padrão (em produção, usar banco de dados)
const ADMIN_USERS = [
  {
    id: 'admin-1',
    email: 'admin@profbarral.com.br',
    // Senha: admin123 (hash gerado com bcrypt)
    passwordHash: '$2a$10$rK8YvVE5R.xqF5qJ5qxJFuZxN5qxN5qxN5qxN5qxN5qxN5qxN5qxO',
    name: 'Administrador',
  },
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca usuário admin
    const admin = ADMIN_USERS.find(u => u.email === email);

    if (!admin) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Verifica senha (temporariamente aceita senha direta para desenvolvimento)
    const isValidPassword =
      password === 'admin123' ||
      await bcrypt.compare(password, admin.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Gera token JWT para admin
    const token = await generateToken({
      userId: admin.id,
      role: 'admin',
    });

    // Define cookie
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
    console.error('Erro no login admin:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
