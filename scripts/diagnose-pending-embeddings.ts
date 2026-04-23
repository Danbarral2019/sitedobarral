import { prisma } from '../lib/prisma';

async function main() {
  console.log('=== Estado atual das filas de embeddings ===\n');

  console.log('--- Document ---');
  const docStatus = await prisma.$queryRaw<Array<{ status: string | null; count: bigint }>>`
    SELECT "embeddingStatus" as status, COUNT(*)::int as count
    FROM "Document"
    GROUP BY "embeddingStatus"
    ORDER BY count DESC
  `;
  for (const row of docStatus) console.log(`  ${row.status ?? 'NULL'}: ${row.count}`);

  console.log('\n--- TribunalDecision ---');
  const tdStatus = await prisma.$queryRaw<Array<{ status: string | null; approval: string; count: bigint }>>`
    SELECT "embeddingStatus" as status, "approvalStatus" as approval, COUNT(*)::int as count
    FROM "TribunalDecision"
    GROUP BY "embeddingStatus", "approvalStatus"
    ORDER BY count DESC
  `;
  for (const row of tdStatus) console.log(`  emb=${row.status ?? 'NULL'}  appr=${row.approval}: ${row.count}`);

  console.log('\n--- Últimas decisões TCU criadas em Document (últimos 30 dias) ---');
  const recentTcu = await prisma.$queryRaw<Array<{ category: string; created: Date; emb: string | null }>>`
    SELECT category, "uploadedAt" as created, "embeddingStatus" as emb
    FROM "Document"
    WHERE "tcuNumeroAcordao" IS NOT NULL AND "uploadedAt" > NOW() - INTERVAL '30 days'
    ORDER BY "uploadedAt" DESC
    LIMIT 10
  `;
  for (const row of recentTcu) console.log(`  [${row.category}] ${row.created.toISOString().slice(0, 10)} → embedding=${row.emb ?? 'NULL'}`);

  console.log('\n--- Últimas TribunalDecisions criadas (últimos 30 dias) ---');
  const recentTd = await prisma.$queryRaw<Array<{ tribunal: string; created: Date; emb: string | null; appr: string }>>`
    SELECT "tribunalCode" as tribunal, "createdAt" as created, "embeddingStatus" as emb, "approvalStatus" as appr
    FROM "TribunalDecision"
    WHERE "createdAt" > NOW() - INTERVAL '30 days'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;
  for (const row of recentTd) console.log(`  [${row.tribunal}] ${row.created.toISOString().slice(0, 10)} → embedding=${row.emb ?? 'NULL'}  approval=${row.appr}`);

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
