import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const PUT = withAdminAuth(async (request: NextRequest) => {
  try {
    const { id, validDays, maxUses } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do QR Code não fornecido' },
        { status: 400 }
      );
    }

    // Busca o QR Code existente
    const existingQR = await prisma.qRCode.findUnique({
      where: { id },
    });

    if (!existingQR) {
      return NextResponse.json(
        { error: 'QR Code não encontrado' },
        { status: 404 }
      );
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
  } catch (error) {
    console.error('Erro ao atualizar QR Code:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar QR Code' },
      { status: 500 }
    );
  }
});
