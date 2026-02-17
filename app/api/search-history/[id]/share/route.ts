import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, AuthenticationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

// POST /api/search-history/[id]/share - Gerar link compartilhável
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError();
    }

    const { id } = await params;

    const entry = await prisma.searchHistory.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundError('Histórico de busca');
    }

    if (entry.userId !== authResult.user.userId) {
      throw new NotFoundError('Histórico de busca');
    }

    // Se já tem shareId, retornar o existente
    if (entry.shareId && entry.isPublic) {
      const url = `${process.env.NEXT_PUBLIC_BASE_URL}/busca/${entry.shareId}`;
      return NextResponse.json({ shareId: entry.shareId, url });
    }

    // Gerar novo shareId
    const shareId = crypto.randomUUID().slice(0, 8);

    await prisma.searchHistory.update({
      where: { id },
      data: {
        isPublic: true,
        shareId,
      },
    });

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/busca/${shareId}`;

    apiLogger.info({ searchHistoryId: id, shareId }, 'Search history shared');

    return NextResponse.json({ shareId, url });
  } catch (error) {
    return handleApiError(error);
  }
}
