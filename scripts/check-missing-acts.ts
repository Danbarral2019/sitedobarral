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
  // Check the 9 new LegislativeActs
  const newActs = await prisma.legislativeAct.findMany({
    where: {
      fullNumber: {
        in: [
          'Resolução SEGES-CICS/MGI 2/2024',
          'Resolução SEGES-CICS/MGI 4/2024',
          'Resolução SEGES-CICS/MGI 5/2024',
          'Resolução SEGES-CICS/MGI 6/2024',
          'Resolução CICS/MGI 7/2024',
          'Resolução CIIA-PAC/CC 3/2025',
          'Portaria SEGES/MGI 1.769/2023',
          'Portaria SEGES/MGI 4.932/2023',
          'MP 1.167/2023',
        ]
      }
    },
    select: {
      fullNumber: true,
      type: true,
      esfera: true,
      themes: true,
      hierarchyLevel: true,
      issuer: true,
    }
  });

  console.log('=== 9 Novos LegislativeAct ===');
  for (const act of newActs) {
    console.log(`  ${act.fullNumber}: type=${act.type}, esfera=${act.esfera}, themes=${act.themes}, level=${act.hierarchyLevel}, issuer=${act.issuer}`);
  }

  // Check orientacoes
  const oriCount = await prisma.document.count({
    where: { category: 'orientacao_procedimento' }
  });
  console.log(`\n=== Orientações: ${oriCount} documentos ===`);

  // Check one sample
  const sample = await prisma.document.findFirst({
    where: { category: 'orientacao_procedimento' },
    select: { title: true, category: true, isPublic: true, reviewed: true, type: true, url: true }
  });
  console.log('Sample:', sample);

  // Check what tabs return
  console.log('\n=== Contagem por tab ===');

  // atos tab - LegislativeAct count
  const atosCount = await prisma.legislativeAct.count();
  console.log(`LegislativeAct total: ${atosCount}`);

  // Check types that exist
  const types = await prisma.legislativeAct.groupBy({
    by: ['type'],
    _count: true,
  });
  console.log('Types:', types.map(t => `${t.type}(${t._count})`).join(', '));

  // boas-praticas tab
  const bpCount = await prisma.document.count({
    where: { category: 'boa_pratica', isPublic: true, reviewed: true }
  });
  console.log(`Document boa_pratica (public+reviewed): ${bpCount}`);

  // orientacoes tab
  const oriPublic = await prisma.document.count({
    where: { category: 'orientacao_procedimento', isPublic: true, reviewed: true }
  });
  console.log(`Document orientacao_procedimento (public+reviewed): ${oriPublic}`);

  await prisma.$disconnect();
}

main().catch(console.error);
