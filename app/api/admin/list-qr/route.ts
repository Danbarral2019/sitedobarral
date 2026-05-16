import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '6');
    const skip = (page - 1) * limit;

    // Buscar QR codes paginados (sem carregar imagens base64 grandes)
    const [qrCodes, total] = await Promise.all([
      prisma.qRCode.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          qrCodeImage: true, // Manteremos por enquanto, mas poderia ser lazy
          courseId: true,
          turma: true,
          validUntil: true,
          maxUses: true,
          usedCount: true,
          createdAt: true,
        },
      }),
      prisma.qRCode.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      qrCodes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao listar QR Codes:');
    return NextResponse.json(
      { error: 'Erro ao listar QR Codes' },
      { status: 500 }
    );
  }
});
