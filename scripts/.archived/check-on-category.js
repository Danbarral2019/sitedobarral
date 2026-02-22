require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCategories() {
  // Contar documentos por categoria
  const groupedByCategory = await prisma.document.groupBy({
    by: ['category'],
    _count: true,
    orderBy: {
      _count: {
        category: 'desc'
      }
    }
  });

  console.log('\n📊 Documentos por categoria:');
  console.log('═'.repeat(60));
  groupedByCategory.forEach(item => {
    console.log(`  ${item.category.padEnd(25)} → ${item._count} documentos`);
  });

  // Verificar especificamente orientacao-normativa
  const onDocs = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: {
      id: true,
      title: true,
      category: true,
      courseId: true,
      isPublic: true
    },
    take: 5
  });

  console.log('\n✅ Exemplos de documentos "orientacao-normativa":');
  console.log('═'.repeat(60));
  onDocs.forEach(doc => {
    console.log(`  ${doc.title.substring(0, 50)}...`);
    console.log(`    Categoria: ${doc.category}`);
    console.log(`    Curso: ${doc.courseId}`);
    console.log(`    Público: ${doc.isPublic}`);
    console.log('');
  });

  // Verificar se há documentos com categoria diferente
  const notOrientation = await prisma.document.count({
    where: {
      title: {
        contains: 'ON '
      },
      category: {
        not: 'orientacao-normativa'
      }
    }
  });

  console.log(`\n⚠️  Documentos "ON" com categoria diferente: ${notOrientation}`);

  await prisma.$disconnect();
}

checkCategories();
