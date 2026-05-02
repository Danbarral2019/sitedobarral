import { prisma } from '../lib/prisma';

async function main() {
  const docCounts = await prisma.document.groupBy({
    by: ['category'],
    where: { category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] } },
    _count: { _all: true },
  });
  console.log('=== Document table — pareceres (todos) ===');
  docCounts.forEach(c => console.log(`  ${c.category}: ${c._count._all}`));

  // Filtrando isPublic=true (que é o que a UI mostra)
  const publicCounts = await prisma.document.groupBy({
    by: ['category'],
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] },
      isPublic: true,
    },
    _count: { _all: true },
  });
  console.log('\n=== Apenas isPublic=true ===');
  publicCounts.forEach(c => console.log(`  ${c.category}: ${c._count._all}`));

  // Total isPublic vs não
  const isPubAll = await prisma.document.groupBy({
    by: ['isPublic'],
    where: { category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] } },
    _count: { _all: true },
  });
  console.log('\n=== Por isPublic ===');
  isPubAll.forEach(c => console.log(`  isPublic=${c.isPublic}: ${c._count._all}`));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
