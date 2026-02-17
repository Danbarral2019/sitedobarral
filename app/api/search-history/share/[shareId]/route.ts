import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

// GET /api/search-history/share/[shareId] - Buscar resposta compartilhada (público)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;

    const entry = await prisma.searchHistory.findFirst({
      where: {
        shareId,
        isPublic: true,
      },
      select: {
        query: true,
        aiAnswer: true,
        sources: true,
        legalSources: true,
        createdAt: true,
      },
    });

    if (!entry) {
      throw new NotFoundError('Resposta compartilhada');
    }

    return NextResponse.json({
      query: entry.query,
      aiAnswer: entry.aiAnswer,
      sources: entry.sources ? JSON.parse(entry.sources) : [],
      legalSources: entry.legalSources ? JSON.parse(entry.legalSources) : [],
      createdAt: entry.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
