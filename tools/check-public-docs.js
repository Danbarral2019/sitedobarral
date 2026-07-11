import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkPublicDocs() {
  const publicCount = await prisma.document.count({
    where: {
      leiArticles: { not: null },
      isPublic: true
    }
  });

  const totalCount = await prisma.document.count({
    where: {
      leiArticles: { not: null }
    }
  });

  const byCategory = await prisma.document.groupBy({
    by: ['category', 'isPublic'],
    where: {
      leiArticles: { not: null }
    },
    _count: true
  });

  console.log('=== DOCUMENTOS COM leiArticles ===');
  console.log(`Públicos: ${publicCount}`);
  console.log(`Total: ${totalCount}`);
  console.log(`\n=== POR CATEGORIA ===`);
  byCategory.forEach(row => {
    console.log(`${row.category || 'null'} | isPublic: ${row.isPublic} | ${row._count} docs`);
  });

  await prisma.$disconnect();
}

checkPublicDocs().catch(console.error);
