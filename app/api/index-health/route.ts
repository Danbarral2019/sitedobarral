import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/index-health
 *
 * Endpoint público read-only que retorna contagens agregadas do estado de
 * indexação (FTS + embeddings). Usado por agentes remotos de monitoramento
 * pra decidir se a fila está saudável sem precisar de DB credentials.
 *
 * Não expõe PII nem segredos — apenas counts.
 */
export async function GET() {
  try {
    const [docByStatus, docFailedR2, lactTotal, lactWithSummary, lactWithEmbedding] =
      await Promise.all([
        prisma.document.groupBy({
          by: ['embeddingStatus'],
          _count: true,
        }),
        prisma.document.count({
          where: {
            embeddingStatus: 'failed',
            embeddingError: { contains: 'Failed to download from R2' },
          },
        }),
        prisma.legislativeAct.count(),
        prisma.legislativeAct.count({ where: { summary: { not: null } } }),
        prisma.legislativeAct.count({ where: { embeddingStatus: 'completed' } }),
      ]);

    const docCounts = {
      completed: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      null: 0,
    };
    for (const row of docByStatus) {
      const key = row.embeddingStatus ?? 'null';
      if (key in docCounts) {
        docCounts[key as keyof typeof docCounts] = row._count;
      }
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      document: {
        ...docCounts,
        failedR2: docFailedR2,
        failedNonR2: Math.max(0, docCounts.failed - docFailedR2),
      },
      legislativeAct: {
        total: lactTotal,
        withSummary: lactWithSummary,
        summaryNulls: lactTotal - lactWithSummary,
        withEmbedding: lactWithEmbedding,
        embeddingMissing: lactTotal - lactWithEmbedding,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
