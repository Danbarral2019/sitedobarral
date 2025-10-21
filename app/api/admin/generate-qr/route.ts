import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { createQRCode } from '@/lib/qrcode';
import { rateLimiters } from '@/lib/rate-limit';

export const POST = withAdminAuth(async (request: NextRequest) => {
  // Rate limiting: 3 gerações de QR Code por hora
  try {
    await rateLimiters.qrcode.check(request, 3);
  } catch {
    return NextResponse.json(
      { error: 'Limite de geração de QR Codes atingido. Tente novamente mais tarde.' },
      { status: 429 }
    );
  }

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
