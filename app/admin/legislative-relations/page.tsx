/**
 * Admin — Fila de revisão de relações entre atos normativos.
 *
 * Lista todas as LegislativeActRelation com reviewStatus='pending' (detectadas
 * por heurística ou IA mas ainda não confirmadas/rejeitadas por admin).
 *
 * Padrão Server Component → busca dados, passa pro Client que renderiza UI
 * + faz chamadas pra API admin de PATCH/DELETE.
 */

import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { LegislativeRelationsClient } from './LegislativeRelationsClient';

export const metadata: Metadata = {
  title: 'Fila de relações pendentes — Admin',
  robots: { index: false, follow: false },
};

export interface PendingRelation {
  id: string;
  relationType: string;
  excerpt: string;
  confidence: number;
  source: string;
  detectedAt: string;
  sourceAct: { id: string; fullNumber: string; title: string };
  targetAct: { id: string; fullNumber: string; title: string };
}

export default async function LegislativeRelationsAdminPage() {
  const rows = await prisma.legislativeActRelation.findMany({
    where: { reviewStatus: 'pending' },
    include: {
      sourceAct: { select: { id: true, fullNumber: true, title: true } },
      targetAct: { select: { id: true, fullNumber: true, title: true } },
    },
    orderBy: [{ confidence: 'desc' }, { detectedAt: 'desc' }],
  });

  // Stats agregados
  const totalConfirmed = await prisma.legislativeActRelation.count({ where: { reviewStatus: 'confirmed' } });
  const totalRejected = await prisma.legislativeActRelation.count({ where: { reviewStatus: 'rejected' } });

  const pending: PendingRelation[] = rows.map((r) => ({
    id: r.id,
    relationType: r.relationType,
    excerpt: r.excerpt,
    confidence: r.confidence,
    source: r.source,
    detectedAt: r.detectedAt.toISOString(),
    sourceAct: r.sourceAct,
    targetAct: r.targetAct,
  }));

  return (
    <LegislativeRelationsClient
      initialPending={pending}
      stats={{ confirmed: totalConfirmed, rejected: totalRejected }}
    />
  );
}
