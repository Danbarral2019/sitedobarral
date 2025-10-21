import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { createQRCode } from '@/lib/qrcode';
import { rateLimiters } from '@/lib/rate-limit';

// Aumenta timeout para 60 segundos (necessário para geração de QR code)
export const maxDuration = 60;

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
    console.log('[QR Code] Iniciando geração...');
    const { courseId, turma, validDays, maxUses } = await request.json();

    if (!courseId || !turma || !validDays) {
      console.log('[QR Code] Parâmetros inválidos:', { courseId, turma, validDays });
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Calcula data de validade
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));

    console.log('[QR Code] Chamando createQRCode...');
    // Gera QR Code
    const { code, qrCodeImage } = await createQRCode(
      courseId,
      turma,
      validUntil,
      maxUses ? parseInt(maxUses) : undefined
    );

    console.log('[QR Code] QR Code gerado com sucesso. Código:', code);
    console.log('[QR Code] Tamanho da imagem:', qrCodeImage.length, 'caracteres');

    const response = {
      success: true,
      code,
      qrCodeImage,
      validUntil: validUntil.toISOString(),
    };

    console.log('[QR Code] Enviando resposta...');
    return NextResponse.json(response);
  } catch (error) {
    console.error('[QR Code] Erro ao gerar QR Code:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar QR Code' },
      { status: 500 }
    );
  }
});
