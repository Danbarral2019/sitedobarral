const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocs() {
  const docs = await prisma.document.findMany({
    where: {
      leiArticles: { contains: '92' },
      isPublic: true
    },
    select: {
      id: true,
      title: true,
      category: true,
      leiArticles: true
    }
  });

  console.log('Total documentos públicos com Art. 92:', docs.length);

  const byCategory = {};
  docs.forEach(doc => {
    byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
  });

  console.log('\nPor categoria:');
  console.log(JSON.stringify(byCategory, null, 2));

  await prisma.$disconnect();
}

checkDocs().catch(console.error);
