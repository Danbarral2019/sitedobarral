import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/tribunal-decisions/stats
 * Estatísticas agregadas de decisões de tribunais
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [
      total,
      totalPending,
      totalApproved,
      totalRejected,
      byTribunalRaw,
      byTypeRaw,
      byYearRaw,
      recentActivity,
    ] = await Promise.all([
      prisma.tribunalDecision.count(),
      prisma.tribunalDecision.count({ where: { approvalStatus: 'pending' } }),
      prisma.tribunalDecision.count({
        where: { approvalStatus: { in: ['auto_approved', 'manually_approved'] } },
      }),
      prisma.tribunalDecision.count({
        where: { approvalStatus: { in: ['auto_rejected', 'manually_rejected'] } },
      }),
      prisma.tribunalDecision.groupBy({
        by: ['tribunalCode', 'tribunalName'],
        _count: { id: true },
      }),
      prisma.tribunalDecision.groupBy({
        by: ['decisionType'],
        _count: { id: true },
      }),
      prisma.tribunalDecision.groupBy({
        by: ['year'],
        _count: { id: true },
        orderBy: { year: 'desc' },
      }),
      prisma.tribunalDecision.findMany({
        select: {
          id: true,
          tribunalCode: true,
          title: true,
          decisionType: true,
          approvalStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Para byTribunal, precisamos de pending/approved/rejected por tribunal
    // Fazer queries adicionais agrupadas
    const [pendingByTribunal, approvedByTribunal, rejectedByTribunal] = await Promise.all([
      prisma.tribunalDecision.groupBy({
        by: ['tribunalCode'],
        where: { approvalStatus: 'pending' },
        _count: { id: true },
      }),
      prisma.tribunalDecision.groupBy({
        by: ['tribunalCode'],
        where: { approvalStatus: { in: ['auto_approved', 'manually_approved'] } },
        _count: { id: true },
      }),
      prisma.tribunalDecision.groupBy({
        by: ['tribunalCode'],
        where: { approvalStatus: { in: ['auto_rejected', 'manually_rejected'] } },
        _count: { id: true },
      }),
    ]);

    const pendingMap = Object.fromEntries(pendingByTribunal.map(r => [r.tribunalCode, r._count.id]));
    const approvedMap = Object.fromEntries(approvedByTribunal.map(r => [r.tribunalCode, r._count.id]));
    const rejectedMap = Object.fromEntries(rejectedByTribunal.map(r => [r.tribunalCode, r._count.id]));

    const byTribunal = byTribunalRaw.map(r => ({
      tribunalCode: r.tribunalCode,
      tribunalName: r.tribunalName,
      total: r._count.id,
      pending: pendingMap[r.tribunalCode] || 0,
      approved: approvedMap[r.tribunalCode] || 0,
      rejected: rejectedMap[r.tribunalCode] || 0,
    }));

    const byType = byTypeRaw.map(r => ({
      decisionType: r.decisionType,
      count: r._count.id,
    }));

    const byYear = byYearRaw.map(r => ({
      year: r.year,
      count: r._count.id,
    }));

    return NextResponse.json({
      total,
      totalPending,
      totalApproved,
      totalRejected,
      byTribunal,
      byType,
      byYear,
      recentActivity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
