/**
 * Camada de persistência das relações entre atos normativos.
 *
 * Recebe candidatos detectados (heurística ou IA), faz lookup do target por
 * fullNumber, e grava em LegislativeActRelation via upsert. Pula candidatos
 * sem target cadastrado e self-relations.
 */
import { prisma } from '@/lib/prisma';
import { detectAmendments, type DetectedRelation } from './amendment-detector';
import { detectAmendmentsAI } from './amendment-detector-ai';

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

/**
 * Roda detector heurístico + (opt-in) detector via IA, mescla resultados
 * deduplicando por `(relationType, targetFullNumber)` (preserva o de maior
 * confidence em colisão), e persiste tudo via `saveDetectedRelations`.
 *
 * IA roda apenas se:
 *  - Env `DETECT_AMENDMENTS_AI === 'true'`
 *  - Heurística achou ≥1 match (sinaliza ato relevante — evita custo de API
 *    em atos sem nenhum verbo de alteração)
 *  - `GEMINI_API_KEY` está configurada (já checado dentro de detectAmendmentsAI)
 *
 * Retorna SaveResult agregado com `aiAdded` indicando quantas relações vieram
 * da IA (que não estavam na heurística).
 */
export interface HybridSaveResult extends SaveResult {
  heuristicCount: number;
  aiAdded: number;
}

export async function detectAndSaveRelationsHybrid(
  sourceActId: string,
  ementa: string,
  content: string,
): Promise<HybridSaveResult> {
  const heuristic = detectAmendments(ementa, content);
  const aiEnabled = process.env.DETECT_AMENDMENTS_AI === 'true';

  let merged: DetectedRelation[] = heuristic;
  let aiAdded = 0;

  if (aiEnabled && heuristic.length > 0) {
    const ai = await detectAmendmentsAI(ementa, content);
    if (ai.length > 0) {
      // Dedup por (relationType, targetFullNumber). Em colisão, mantém o de
      // maior confidence (geralmente IA, que retorna 0.5-1.0 vs heurística 0.7-0.9).
      const map = new Map<string, DetectedRelation>();
      for (const r of [...heuristic, ...ai]) {
        const key = `${r.relationType}|${r.targetFullNumber}`;
        const existing = map.get(key);
        if (!existing || r.confidence > existing.confidence) map.set(key, r);
      }
      const before = merged.length;
      merged = Array.from(map.values());
      aiAdded = Math.max(0, merged.length - before);
    }
  }

  // Source label: 'ia' se a maioria das relações vier da IA. Pra simplificar,
  // marcamos sempre 'heuristica' aqui (origem PRIMÁRIA) — refinamento futuro
  // pode salvar uma source por relação individual via API mais granular.
  const result = await saveDetectedRelations(sourceActId, merged, 'heuristica');

  return { ...result, heuristicCount: heuristic.length, aiAdded };
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
