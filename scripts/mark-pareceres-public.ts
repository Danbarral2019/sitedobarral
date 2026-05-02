import { prisma } from '../lib/prisma';

async function main() {
  const r = await prisma.document.updateMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
      isPublic: false,
    },
    data: { isPublic: true },
  });
  console.log('Tornados públicos:', r.count);

  const after = await prisma.document.groupBy({
    by: ['category'],
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
      isPublic: true,
    },
    _count: { _all: true },
  });
  console.log('Public counts:');
  after.forEach(c => console.log(`  ${c.category}: ${c._count._all}`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
