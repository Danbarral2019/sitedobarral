import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { createQRCode } from '@/lib/qrcode';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { apiLogger } from "@/lib/logger";

// Aumenta timeout para 60 segundos (necessário para geração de QR code)
export const maxDuration = 60;

export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    // Rate limiting: 3 gerações de QR Code por hora (Redis, window=3600s)
    const ip = getClientIp(request);
    await enforceRateLimit(`admin:qr:${ip}`, 3, 3600);
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
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Limite de geração de QR Codes atingido. Tente novamente mais tarde.' },
        { status: 429 }
      );
    }
    apiLogger.error({ err: error }, 'Erro ao gerar QR Code:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar QR Code' },
      { status: 500 }
    );
  }
});
