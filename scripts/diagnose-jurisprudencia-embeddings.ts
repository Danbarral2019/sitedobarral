/**
 * Sanity check para Bug 2 (roadmap 2026-04-24):
 * Antes de trocar fetchUnifiedTopK por semanticSearch na rota de
 * /api/jurisprudencia/query, confirmar que há chunks com embedding
 * suficientes para TCU (Document acordao/consulta_tcu) e para os TCEs
 * (TribunalDecision). Se chunks TCU estiverem zerados, o refactor não
 * resolve — o bug raiz é indexação, não ranking.
 */

import { prisma } from '../lib/prisma';

async function main() {
  console.log('\n=== Document (TCU acordao/consulta_tcu) ===');
  const docByCategory = await prisma.$queryRaw<
    Array<{ category: string; total: number; completed: number }>
  >`
    SELECT category,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "embeddingStatus" = 'completed')::int AS completed
    FROM "Document"
    WHERE category IN ('acordao', 'consulta_tcu', 'informativo', 'manual-tcu', 'enunciados')
    GROUP BY category
    ORDER BY category
  `;
  console.table(docByCategory);

  const chunkByDocCategory = await prisma.$queryRaw<
    Array<{ category: string; chunks: number }>
  >`
    SELECT d.category, COUNT(dc.id)::int AS chunks
    FROM "Document" d
    LEFT JOIN "DocumentChunk" dc ON dc."documentId" = d.id
    WHERE d.category IN ('acordao', 'consulta_tcu', 'informativo', 'manual-tcu', 'enunciados')
    GROUP BY d.category
    ORDER BY d.category
  `;
  console.log('\n=== DocumentChunk por categoria ===');
  console.table(chunkByDocCategory);

  console.log('\n=== TribunalDecision por tribunal (embeddingStatus) ===');
  const tdByTribunal = await prisma.$queryRaw<
    Array<{
      tribunalCode: string;
      total: number;
      completed: number;
      approved: number;
    }>
  >`
    SELECT "tribunalCode",
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "embeddingStatus" = 'completed')::int AS completed,
           COUNT(*) FILTER (
             WHERE "approvalStatus" IN ('auto_approved', 'manually_approved')
               AND "isRelevant" = true
           )::int AS approved
    FROM "TribunalDecision"
    GROUP BY "tribunalCode"
    ORDER BY total DESC
  `;
  console.table(tdByTribunal);

  console.log('\n=== TribunalDecisionChunk por tribunal ===');
  const tdChunkByTribunal = await prisma.$queryRaw<
    Array<{ tribunalCode: string; chunks: number }>
  >`
    SELECT td."tribunalCode", COUNT(tdc.id)::int AS chunks
    FROM "TribunalDecision" td
    LEFT JOIN "TribunalDecisionChunk" tdc ON tdc."tribunalDecisionId" = td.id
    GROUP BY td."tribunalCode"
    ORDER BY chunks DESC
  `;
  console.table(tdChunkByTribunal);

  console.log('\n=== relevanceScore: distribuição por tribunal ===');
  const scoreDist = await prisma.$queryRaw<
    Array<{
      tribunalCode: string;
      min_score: number;
      avg_score: number;
      max_score: number;
      count: number;
    }>
  >`
    SELECT "tribunalCode",
           MIN("relevanceScore")::int AS min_score,
           AVG("relevanceScore")::int AS avg_score,
           MAX("relevanceScore")::int AS max_score,
           COUNT(*)::int AS count
    FROM "TribunalDecision"
    WHERE "isRelevant" = true
      AND "approvalStatus" IN ('auto_approved', 'manually_approved')
    GROUP BY "tribunalCode"
    ORDER BY avg_score DESC
  `;
  console.table(scoreDist);
  console.log(
    '(lembrete: Documents TCU aparecem com relevanceScore=50 HARDCODED no unified-query, não aqui)'
  );

  console.log('\n=== Sanity query: "segregação de funções" em ementa TCU ===');
  const tcuSegregacao = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      tcuNumeroAcordao: string | null;
      tcuDataJulgamento: Date | null;
    }>
  >`
    SELECT id, title, "tcuNumeroAcordao", "tcuDataJulgamento"
    FROM "Document"
    WHERE category IN ('acordao', 'consulta_tcu')
      AND (
        "tcuEmentaCompleta" ILIKE '%segregação de funções%'
        OR title ILIKE '%segregação de funções%'
      )
    ORDER BY "tcuDataJulgamento" DESC NULLS LAST
    LIMIT 10
  `;
  console.table(tcuSegregacao);

  console.log('\n=== E em TribunalDecision ementa ===');
  const tdSegregacao = await prisma.$queryRaw<
    Array<{
      tribunalCode: string;
      decisionNumber: string;
      title: string;
      dataJulgamento: Date | null;
    }>
  >`
    SELECT "tribunalCode", "decisionNumber", title, "dataJulgamento"
    FROM "TribunalDecision"
    WHERE "isRelevant" = true
      AND "approvalStatus" IN ('auto_approved', 'manually_approved')
      AND (title ILIKE '%segregação de funções%' OR ementa ILIKE '%segregação de funções%')
    ORDER BY "dataJulgamento" DESC NULLS LAST
    LIMIT 10
  `;
  console.table(tdSegregacao);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
