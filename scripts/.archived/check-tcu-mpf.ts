import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error('DATABASE_URL not set'); process.exit(1); }

const adapter = new PrismaNeon({ connectionString: connStr });
const prisma = new PrismaClient({ adapter });

async function main() {
  // All boa_pratica documents
  const docs = await prisma.document.findMany({
    where: { category: 'boa_pratica' },
    select: {
      id: true,
      title: true,
      category: true,
      isPublic: true,
      reviewed: true,
      type: true,
      url: true,
      issuerOrg: true,
      esfera: true,
      douData: true,
      uploadedAt: true,
      metaDou: { select: { data: true, url: true } },
    },
    orderBy: { title: 'asc' },
  });

  console.log(`=== Document category=boa_pratica: ${docs.length} total ===\n`);
  for (const doc of docs) {
    const flags = [];
    if (!doc.isPublic) flags.push('NOT PUBLIC');
    if (!doc.reviewed) flags.push('NOT REVIEWED');
    if (!doc.url) flags.push('NO URL');
    const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
    console.log(`  ${doc.title}`);
    console.log(`    type=${doc.type}, org=${doc.issuerOrg}, esfera=${doc.esfera}, douData=${doc.douData}, metaDou.data=${doc.metaDou?.data}${flagStr}`);
    console.log();
  }

  // Check what the API query would return
  const publicReviewed = await prisma.document.count({
    where: { category: 'boa_pratica', isPublic: true, reviewed: true }
  });
  console.log(`Public + Reviewed count: ${publicReviewed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
