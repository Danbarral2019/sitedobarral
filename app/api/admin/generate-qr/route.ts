import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { createQRCode } from '@/lib/qrcode';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { ValidationError } from '@/lib/errors/api-error';

// Aumenta timeout para 60 segundos (necessário para geração de QR code)
export const maxDuration = 60;

export const POST = withAdminApi(async (request: NextRequest) => {
  // Rate limiting: 3 gerações de QR Code por hora (Redis, window=3600s)
  // Granular para QR (mais restritivo que o padrão de admin), por isso chama
  // enforceRateLimit diretamente com chave própria em vez de depender do
  // rate-limit do handler.
  const ip = getClientIp(request);
  await enforceRateLimit(`admin:qr:${ip}`, 3, 3600, { failureMode: 'closed' });

  const { courseId, turma, validDays, maxUses } = await request.json();

  if (!courseId || !turma || !validDays) {
    throw new ValidationError('Parâmetros inválidos');
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
});
