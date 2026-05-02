import { prisma } from '../lib/prisma';

async function main() {
  const docs = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      aiClassification: { contains: '"summary"' },
    },
    select: { title: true, aiClassification: true },
    take: 8,
    orderBy: { uploadedAt: 'desc' },
  });
  console.log(`=== ${docs.length} amostras ===\n`);
  for (const d of docs) {
    const ai = JSON.parse(d.aiClassification!);
    console.log('— ' + d.title.slice(0, 95));
    console.log('  ' + ai.summary);
    console.log('');
  }

  const total = await prisma.document.count({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      aiClassification: { contains: '"summary"' },
    },
  });
  console.log(`Total com summary: ${total}`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
