import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';

/**
 * GET /api/admin/dou/stats
 * Retorna estatísticas do staging de documentos DOU
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      throw new AuthenticationError('Unauthorized');
    }

    const result = await withCache(
      CacheKeys.douStats(),
      async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
          totalStaging,
          pending,
          autoApproved,
          approvedThisMonth,
          rejectedThisMonth,
          importedTotal,
        ] = await Promise.all([
          prisma.dOUStagingDocument.count(),
          prisma.dOUStagingDocument.count({
            where: { approvalStatus: 'pending' },
          }),
          prisma.dOUStagingDocument.count({
            where: {
              approvalStatus: 'auto_approved',
              imported: false,
            },
          }),
          prisma.dOUStagingDocument.count({
            where: {
              finalDecision: 'approved',
              reviewedAt: { gte: startOfMonth },
            },
          }),
          prisma.dOUStagingDocument.count({
            where: {
              finalDecision: 'rejected',
              reviewedAt: { gte: startOfMonth },
            },
          }),
          prisma.dOUStagingDocument.count({
            where: { imported: true },
          }),
        ]);

        return {
          totalStaging,
          pending,
          autoApproved,
          approvedThisMonth,
          rejectedThisMonth,
          importedTotal,
        };
      },
      CACHE_TTL.DOU_STATS,
      { prefix: 'dou' }
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
