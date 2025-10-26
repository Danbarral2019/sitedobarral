import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { rateLimiters } from '@/lib/rate-limit';


export async function POST(request: NextRequest) {
  // Rate limiting: 5 tentativas de login admin por minuto
  try {
    await rateLimiters.auth.check(request, 5);
  } catch {
    return NextResponse.json(
      { error: 'Muitas tentativas de login. Tente novamente em alguns instantes.' },
      { status: 429 }
    );
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca usuário admin no banco de dados
    const admin = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      },
    });

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

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
  } finally {
    await prisma.$disconnect();
  }
}
