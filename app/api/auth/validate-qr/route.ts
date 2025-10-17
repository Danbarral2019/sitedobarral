import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Código QR não fornecido' },
        { status: 400 }
      );
    }

    // Valida o QR Code no banco de dados
    const qrCodeData = await prisma.qRCode.findUnique({
      where: { code: code },
    });

    if (!qrCodeData) {
      return NextResponse.json(
        { error: 'Código QR inválido' },
        { status: 401 }
      );
    }

    // Verifica se o QR Code está válido
    if (new Date() > qrCodeData.validUntil) {
      return NextResponse.json(
        { error: 'Código QR expirado. Entre em contato com o professor.' },
        { status: 401 }
      );
    }

    // Verifica limite de usos
    if (qrCodeData.maxUses && qrCodeData.usedCount >= qrCodeData.maxUses) {
      return NextResponse.json(
        { error: 'QR Code atingiu o limite de usos' },
        { status: 401 }
      );
    }

    // Verifica se já existe alguma matrícula usando este QR Code
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        qrCodeId: qrCodeData.id
      },
      include: {
        user: true
      }
    });

    // Se não existe matrícula, é um QR Code novo que precisa de registro
    if (!existingEnrollment) {
      return NextResponse.json({
        success: true,
        needsRegistration: true,
        qrCode: code,
        courseId: qrCodeData.courseId,
        turma: qrCodeData.turma,
      });
    }

    // Já existe matrícula com este QR Code
    // Direciona para login com informação da conta existente
    return NextResponse.json({
      success: true,
      needsRegistration: false,
      courseId: qrCodeData.courseId,
      message: 'Você já possui uma conta. Use a página de login.',
    });
  } catch (error) {
    console.error('Erro ao validar QR Code:', error);
    return NextResponse.json(
      { error: 'Erro ao processar validação' },
      { status: 500 }
    );
  }
}
