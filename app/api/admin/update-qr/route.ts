import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';

export const PUT = withAdminApi(async (request: NextRequest) => {
  const { id, validDays, maxUses } = await request.json();

  if (!id) {
    throw new ValidationError('ID do QR Code não fornecido');
  }

  // Busca o QR Code existente
  const existingQR = await prisma.qRCode.findUnique({
    where: { id },
  });

  if (!existingQR) {
    throw new NotFoundError('QR Code');
  }

  // Prepara os dados de atualização
  const updateData: Record<string, unknown> = {};

  // Atualiza a data de validade se fornecida
  if (validDays !== undefined) {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));
    updateData.validUntil = validUntil;
  }

  // Atualiza o limite de usos se fornecido
  if (maxUses !== undefined) {
    updateData.maxUses = maxUses ? parseInt(maxUses) : null;
  }

  // Atualiza no banco
  const updatedQR = await prisma.qRCode.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    qrCode: {
      id: updatedQR.id,
      code: updatedQR.code,
      courseId: updatedQR.courseId,
      turma: updatedQR.turma,
      validUntil: updatedQR.validUntil.toISOString(),
      maxUses: updatedQR.maxUses,
      usedCount: updatedQR.usedCount,
    },
  });
});
