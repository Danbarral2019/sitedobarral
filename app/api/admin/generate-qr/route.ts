import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { createQRCode } from '@/lib/qrcode';

export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const { courseId, turma, validDays, maxUses } = await request.json();

    if (!courseId || !turma || !validDays) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Calcula data de validade
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));

    // Gera QR Code
    const { code, qrCodeImage } = await createQRCode(
      courseId,
      turma,
      validUntil,
      maxUses ? parseInt(maxUses) : undefined
    );

    return NextResponse.json({
      success: true,
      code,
      qrCodeImage,
      validUntil: validUntil.toISOString(),
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar QR Code' },
      { status: 500 }
    );
  }
});
