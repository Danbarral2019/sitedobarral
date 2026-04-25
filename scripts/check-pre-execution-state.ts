/**
 * Snapshot do estado antes de rodar a sequência de migração TIC + DOU.
 * Só leitura. Mostra quantos registros cada script provavelmente vai tocar.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n=== Snapshot pré-execução ===\n');

  // 1) Atos com themes contendo 'tic' literal (alvo do normalize-theme-tic)
  const allActs = await prisma.legislativeAct.findMany({
    where: { themes: { not: null } },
    select: { fullNumber: true, themes: true },
  });
  let withTicLiteral = 0;
  let withTecInfo = 0;
  for (const a of allActs) {
    try {
      const t = JSON.parse(a.themes!);
      if (Array.isArray(t)) {
        if (t.includes('tic')) withTicLiteral++;
        if (t.includes('tecnologia-informacao')) withTecInfo++;
      }
    } catch { /* ignore */ }
  }
  console.log(`LegislativeAct: ${allActs.length} com themes preenchido`);
  console.log(`  - com tag 'tic' (legado, será normalizado): ${withTicLiteral}`);
  console.log(`  - com tag 'tecnologia-informacao' (canônica):  ${withTecInfo}`);

  // 2) DOU pending (alvo do reclassify-dou-pending)
  const douPending = await prisma.dOUStagingDocument.count({
    where: { approvalStatus: 'pending' },
  });
  const douPendingByCategory = await prisma.dOUStagingDocument.groupBy({
    by: ['category'],
    where: { approvalStatus: 'pending' },
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });
  console.log(`\nDOUStagingDocument pending: ${douPending}`);
  for (const g of douPendingByCategory.slice(0, 10)) {
    console.log(`  ${(g.category ?? '(null)').padEnd(30)} ${g._count}`);
  }

  // 3) Total LegislativeAct
  const totalActs = await prisma.legislativeAct.count();
  console.log(`\nLegislativeAct total: ${totalActs}`);

  // 4) Atos com embeddingStatus pending (alvo do index-legislative-acts)
  const embPending = await prisma.legislativeAct.count({
    where: { embeddingStatus: 'pending' },
  });
  console.log(`LegislativeAct com embeddingStatus='pending' (antes do batch): ${embPending}`);

  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
