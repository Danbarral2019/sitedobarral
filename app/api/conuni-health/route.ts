import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLastSyncInfo } from '@/lib/conuni-sync';

/**
 * GET /api/conuni-health
 *
 * Endpoint público read-only que retorna o status do sync mensal CONUNI.
 * Usado por agente remoto agendado pra alertar quando o sync do dia 1 falhou
 * (sem precisar de DB credentials no ambiente cloud).
 *
 * Não expõe PII nem segredos — apenas counts e timestamps.
 */
export async function GET() {
  try {
    const now = new Date();
    const info = await getLastSyncInfo(prisma);

    let daysSinceLastSync: number | null = null;
    let lastSyncOnSchedule = false;
    if (info.lastSyncedAt) {
      const last = new Date(info.lastSyncedAt);
      daysSinceLastSync = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
      // Sync esperado dia 1 do mês — toleramos 35 dias entre runs (mês longo + atraso)
      lastSyncOnSchedule = daysSinceLastSync <= 35;
    }

    return NextResponse.json({
      checkedAt: now.toISOString(),
      lastSyncedAt: info.lastSyncedAt,
      daysSinceLastSync,
      lastSyncOnSchedule,
      totalDocs: info.totalDocs,
      byCategory: info.byCategory,
      vigenciaCounts: info.vigenciaCounts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
