import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token de verificação é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo token
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 400 }
      );
    }

    // Verificar se o token expirou
    if (user.verificationExpiry && new Date() > user.verificationExpiry) {
      return NextResponse.json(
        { error: 'Token expirado. Solicite um novo email de verificação.' },
        { status: 400 }
      );
    }

    // Atualizar usuário para verificado
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    // Auto-login após verificação
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Buscar usuário atualizado com enrollments
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { enrollments: true },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Email verificado com sucesso!',
        user: {
          id: updatedUser!.id,
          name: updatedUser!.name,
          email: updatedUser!.email,
          role: updatedUser!.role,
          enrollments: updatedUser!.enrollments,
        },
      },
      { status: 200 }
    );

    // Definir cookie de autenticação
    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar email' },
      { status: 500 }
    );
  }
}
