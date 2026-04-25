/**
 * Camada de persistência das relações entre atos normativos.
 *
 * Recebe candidatos detectados (heurística ou IA), faz lookup do target por
 * fullNumber, e grava em LegislativeActRelation via upsert. Pula candidatos
 * sem target cadastrado e self-relations.
 */
import { prisma } from '@/lib/prisma';
import type { DetectedRelation } from './amendment-detector';

export interface SaveResult {
  created: number;
  skipped: number;
  skippedTargets: string[];
}

export async function saveDetectedRelations(
  sourceActId: string,
  detected: DetectedRelation[],
  source: 'heuristica' | 'ia' | 'manual' = 'heuristica',
): Promise<SaveResult> {
  const result: SaveResult = { created: 0, skipped: 0, skippedTargets: [] };

  for (const rel of detected) {
    const target = await prisma.legislativeAct.findUnique({
      where: { fullNumber: rel.targetFullNumber },
      select: { id: true },
    });

    if (!target) {
      result.skipped++;
      result.skippedTargets.push(rel.targetFullNumber);
      continue;
    }

    if (target.id === sourceActId) {
      // Self-relation: ato menciona a si mesmo (raro, mas possível)
      result.skipped++;
      continue;
    }

    await prisma.legislativeActRelation.upsert({
      where: {
        sourceActId_targetActId_relationType: {
          sourceActId,
          targetActId: target.id,
          relationType: rel.relationType,
        },
      },
      create: {
        sourceActId,
        targetActId: target.id,
        relationType: rel.relationType,
        source,
        confidence: rel.confidence,
        excerpt: rel.excerpt,
        reviewStatus: 'pending',
      },
      update: {
        confidence: rel.confidence,
        excerpt: rel.excerpt,
        // detectedAt não atualiza — preserva primeira detecção
      },
    });
    result.created++;
  }

  return result;
}

export interface RelationView {
  id: string;
  relationType: string;
  excerpt: string;
  confidence: number;
  reviewStatus: string;
  sourceAct?: { fullNumber: string; title: string };
  targetAct?: { fullNumber: string; title: string };
}

export interface RelationsForAct {
  alters: RelationView[];      // este ato altera estes outros
  alteredBy: RelationView[];   // este ato é alterado por estes outros
}

export async function getRelationsForAct(
  actId: string,
  opts: { onlyConfirmed?: boolean } = {},
): Promise<RelationsForAct> {
  const reviewFilter = opts.onlyConfirmed ? { reviewStatus: 'confirmed' } : {};

  const [alters, alteredBy] = await Promise.all([
    prisma.legislativeActRelation.findMany({
      where: { sourceActId: actId, ...reviewFilter },
      include: { targetAct: { select: { fullNumber: true, title: true } } },
      orderBy: { detectedAt: 'desc' },
    }),
    prisma.legislativeActRelation.findMany({
      where: { targetActId: actId, ...reviewFilter },
      include: { sourceAct: { select: { fullNumber: true, title: true } } },
      orderBy: { detectedAt: 'desc' },
    }),
  ]);

  return {
    alters: alters as unknown as RelationView[],
    alteredBy: alteredBy as unknown as RelationView[],
  };
}
