import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trackServerEvent } from '@/lib/monitoring/events';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 tentativas por minuto por IP (previne brute-force de QR codes)
    const ip = getClientIp(request);
    await enforceRateLimit(`qr:validate:${ip}`, 10, 60);

    const { code } = await request.json();

    if (!code) {
      throw new ValidationError('Código QR não fornecido');
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

    // Verifica limite de usos (vagas da turma)
    if (qrCodeData.maxUses && qrCodeData.usedCount >= qrCodeData.maxUses) {
      return NextResponse.json(
        {
          error: `Turma lotada! Este QR Code já foi usado por ${qrCodeData.usedCount} alunos (limite: ${qrCodeData.maxUses}).`,
          isFull: true
        },
        { status: 403 }
      );
    }

    trackServerEvent('qr_scan', { courseId: qrCodeData.courseId });

    // Retorna informações do QR Code válido
    // O sistema permitirá registro de múltiplos alunos até atingir maxUses
    return NextResponse.json({
      success: true,
      needsRegistration: true,
      qrCode: code,
      courseId: qrCodeData.courseId,
      turma: qrCodeData.turma,
      vagas: {
        usadas: qrCodeData.usedCount,
        total: qrCodeData.maxUses,
        disponiveis: qrCodeData.maxUses ? qrCodeData.maxUses - qrCodeData.usedCount : null
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
