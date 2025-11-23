const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCategoryCounts() {
  const result = await prisma.document.groupBy({
    by: ['category'],
    where: {
      OR: [
        { leiArticles: null },
        { leiArticles: { equals: '[]' } },
        { leiArticles: { equals: '' } }
      ]
    },
    _count: true
  });

  // Ordenar por contagem decrescente
  result.sort((a, b) => b._count - a._count);

  console.log('\n📊 DOCUMENTOS NÃO INDEXADOS POR CATEGORIA:\n');
  result.forEach(r => {
    const category = (r.category || 'sem-categoria').padEnd(30);
    console.log(`   ${category} | ${r._count} docs`);
  });

  const total = result.reduce((sum, r) => sum + r._count, 0);
  console.log(`\n   TOTAL: ${total} documentos\n`);

  await prisma.$disconnect();
}

getCategoryCounts().catch(console.error);
