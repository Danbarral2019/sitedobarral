import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    // Obter token do cookie
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar e decodificar token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { courseId, price } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: 'ID do curso é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar enrollment existente
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: decoded.userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Matrícula não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se já é vitalício
    if (enrollment.isLifetime) {
      return NextResponse.json(
        { error: 'Você já tem acesso vitalício a este curso' },
        { status: 400 }
      );
    }

    // Atualizar enrollment para vitalício
    const updatedEnrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        isLifetime: true,
        lifetimeUpgradedAt: new Date(),
        lifetimePrice: price || null,
        expiresAt: null, // Remove expiração
      },
    });

    // Registrar log de acesso
    try {
      await prisma.accessLog.create({
        data: {
          userId: decoded.userId,
          courseId,
          action: 'upgrade_lifetime',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Upgrade realizado com sucesso!',
        enrollment: {
          id: updatedEnrollment.id,
          courseId: updatedEnrollment.courseId,
          isLifetime: updatedEnrollment.isLifetime,
          lifetimeUpgradedAt: updatedEnrollment.lifetimeUpgradedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json(
      { error: 'Erro ao processar upgrade' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
