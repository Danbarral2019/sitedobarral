import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sapiensDocs = await prisma.document.findMany({
    where: {
      OR: [
        { url: { contains: 'sapiens.agu.gov.br' } },
        { url: { contains: 'supersapiens.agu.gov.br' } },
      ]
    },
    include: { metaDou: true },
    orderBy: { title: 'asc' }
  });

  console.log('Total documentos com URL Sapiens:', sapiensDocs.length);
  console.log('');

  const byCategory: Record<string, number> = {};
  let withDouUrl = 0;
  let withMetaDou = 0;
  let withoutAny = 0;

  for (const doc of sapiensDocs) {
    byCategory[doc.category || 'null'] = (byCategory[doc.category || 'null'] || 0) + 1;
    if (doc.douUrl) withDouUrl++;
    if (doc.metaDou?.url) withMetaDou++;
    if (!doc.douUrl && !doc.metaDou?.url) withoutAny++;
  }

  console.log('Por categoria:', JSON.stringify(byCategory, null, 2));
  console.log('Com douUrl:', withDouUrl);
  console.log('Com metaDou.url:', withMetaDou);
  console.log('Sem nenhuma URL alternativa:', withoutAny);
  console.log('');

  console.log('=== Documentos sem URL alternativa ===');
  for (const doc of sapiensDocs.filter(d => !d.douUrl && !d.metaDou?.url)) {
    console.log(`  [${doc.category}] ${doc.title}`);
    console.log(`    url: ${doc.url}`);
    console.log('');
  }

  console.log('=== Documentos COM URL alternativa (douUrl ou metaDou) ===');
  for (const doc of sapiensDocs.filter(d => d.douUrl || d.metaDou?.url)) {
    console.log(`  [${doc.category}] ${doc.title}`);
    console.log(`    sapiens: ${doc.url}`);
    console.log(`    douUrl: ${doc.douUrl || '(vazio)'}`);
    console.log(`    metaDou: ${doc.metaDou?.url || '(vazio)'}`);
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
