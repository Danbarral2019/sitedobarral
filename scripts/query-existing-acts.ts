import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Query all LegislativeAct records
  const acts = await prisma.legislativeAct.findMany({
    select: {
      id: true,
      type: true,
      number: true,
      year: true,
      fullNumber: true,
      title: true,
      issuer: true,
    },
    orderBy: [{ type: 'asc' }, { year: 'desc' }, { number: 'desc' }],
  });

  console.log(`\n=== LegislativeAct (${acts.length} registros) ===`);
  for (const act of acts) {
    console.log(`  [${act.type}] ${act.fullNumber} - ${act.title?.substring(0, 80)}... (issuer: ${act.issuer})`);
  }

  // 2. Query Document with category='boa_pratica'
  const docs = await prisma.document.findMany({
    where: { category: 'boa_pratica' },
    select: {
      id: true,
      title: true,
      issuerOrg: true,
      url: true,
    },
    orderBy: { title: 'asc' },
  });

  console.log(`\n=== Document/boa_pratica (${docs.length} registros) ===`);
  for (const doc of docs) {
    console.log(`  ${doc.title} (org: ${doc.issuerOrg})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
