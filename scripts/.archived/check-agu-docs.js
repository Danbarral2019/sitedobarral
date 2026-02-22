require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocs() {
  const docs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: {
      id: true,
      title: true,
      courseId: true,
      url: true,
      isPublic: true
    },
    take: 10
  });

  const total = await prisma.document.count({ where: { category: 'orientacao-normativa' } });
  console.log('Total ONs:', total);
  console.log('\nPrimeiros 10 documentos:');
  docs.forEach(doc => {
    console.log(`- Curso: ${doc.courseId} | ${doc.title.substring(0, 60)}...`);
    console.log(`  URL: ${doc.url.substring(0, 80)}...`);
    console.log(`  Public: ${doc.isPublic}`);
  });

  const byCourse = await prisma.document.groupBy({
    by: ['courseId'],
    where: { category: 'orientacao-normativa' },
    _count: true
  });

  console.log('\nDocumentos por curso:');
  byCourse.forEach(c => console.log(`  Curso ${c.courseId}: ${c._count} documentos`));

  await prisma.$disconnect();
}

checkDocs();
